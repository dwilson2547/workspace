"""
Ducati All-in-One Owner's Manual & Parts Catalog Scraper
Source: https://www.ducati.com/us/en/service-maintenance/ducati-all-in-one

Downloads Owner's Manuals (OM), Spare Parts Catalogs (SPC), and Maintenance
Schedules for all US-market Ducati motorcycles.

Strategy:
  1. Open the page with Playwright. If a combo cache exists, load it from disk
     and skip enumeration — otherwise enumerate all family/model/year combos
     with a single JS evaluate() and save the cache. Pass --rebuild-combos to
     force a fresh enumeration.
  2. While the browser is still open, call Ducati's internal REST API through
     the browser's own request context (context.request.get) so session cookies
     are included automatically — no cookie extraction needed, no 403s.
  3. Close the browser; download PDFs concurrently with httpx. The Contentful
     CDN that serves the PDFs does not require session cookies.

Resume-safe: already-downloaded files are skipped. Re-run periodically to pick
up newly added models. Use --refresh to re-check the API for all combos
(catches new document editions for models already in the manifest).

Requirements:
    pip install playwright httpx
    playwright install chromium
"""

import asyncio
import json
import random
import re
import sys
from pathlib import Path
from urllib.parse import quote, urlparse

import httpx
from playwright.async_api import async_playwright

DUCATI_PAGE       = "https://www.ducati.com/us/en/service-maintenance/ducati-all-in-one"
API_BASE          = "https://www.ducati.com/us/en/api/bikes/bike-documents"
COMBOS_CACHE_FILE = "combos_cache.json"
DOCS_CACHE_FILE   = "docs_cache.json"   # incremental API response cache
PAGE_TIMEOUT      = 60_000   # ms — Playwright navigation / wait_for_function
ENUMERATE_TIMEOUT = 180_000  # ms — the single evaluate() that drives all cascades
DOWNLOAD_TIMEOUT  = 120      # seconds per PDF
CONCURRENT_DL     = 1        # simultaneous PDF downloads
DOWNLOAD_DELAY    = (2, 5)   # seconds — random interval between PDF downloads
API_MAX_RETRIES   = 5        # max attempts on 429 before giving up


# ── Helpers ───────────────────────────────────────────────────────────────

def safe_name(text: str) -> str:
    """Convert a string to a safe directory/file name component."""
    text = text.strip()
    text = re.sub(r'[<>:"/\\|?*\u00b0]', '', text)
    text = re.sub(r'\s+', '_', text)
    text = re.sub(r'[^\w\-]', '_', text)
    text = re.sub(r'_+', '_', text)
    return text.strip('_')


def filename_from_url(url: str) -> str:
    """Extract the PDF filename from a Contentful CDN URL."""
    name = Path(urlparse(url).path).name
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    return name


# ── Browser setup ─────────────────────────────────────────────────────────

async def _navigate_and_init(page) -> None:
    """
    Navigate to the Ducati All-in-One page, dismiss any consent banner, and
    scroll the filter form into view so intersection-observer-gated dropdowns
    initialise properly.
    """
    print(f"Loading {DUCATI_PAGE} ...")
    await page.goto(DUCATI_PAGE, wait_until="load")
    await asyncio.sleep(3)

    for selector in [
        'button:has-text("Accept all")',
        'button:has-text("Accept")',
        'button:has-text("Agree")',
        '[id*="accept"][role="button"]',
        '[class*="cookie"] button',
        '[class*="consent"] button',
    ]:
        try:
            btn = page.locator(selector).first
            await btn.wait_for(state="visible", timeout=4_000)
            await btn.click()
            await asyncio.sleep(1)
            break
        except Exception:
            continue

    await page.evaluate(
        "document.querySelector('select[name=family]')?.scrollIntoView()"
    )
    await asyncio.sleep(2)


# ── Phase 1: enumerate combos ─────────────────────────────────────────────

async def _enumerate_combos_js(page) -> list[dict]:
    """
    Drive the family/model/year cascade inside a single page.evaluate(async)
    call — no Python<->browser round-trips mid-cascade, so the JS execution
    context is never destroyed between steps.
    """
    await page.wait_for_function(
        "() => {"
        "  const s = document.querySelector('select[name=family]');"
        "  return s && s.options.length > 1;"
        "}",
        timeout=PAGE_TIMEOUT,
    )

    page.set_default_timeout(ENUMERATE_TIMEOUT)
    print("Enumerating all family/model/year combinations (this takes a few minutes)...")

    combos: list[dict] = await page.evaluate("""async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const opts  = sel => Array.from(sel.options)
                                  .filter(o => o.value)
                                  .map(o => ({val: o.value, text: o.text.trim()}));

        const famSel = document.querySelector('select[name="family"]');
        const modSel = document.querySelector('select[name="model"]');
        const yrSel  = document.querySelector('select[name="year"]');
        const results = [];

        for (const fam of opts(famSel)) {
            famSel.value = fam.val;
            famSel.dispatchEvent(new Event('change', {bubbles: true}));
            await sleep(600);

            for (const mod of opts(modSel)) {
                modSel.value = mod.val;
                modSel.dispatchEvent(new Event('change', {bubbles: true}));
                await sleep(600);

                for (const yr of opts(yrSel)) {
                    results.push({
                        family_val:  fam.val,
                        family_name: fam.text,
                        model_val:   mod.val,
                        model_name:  mod.text,
                        year_val:    yr.val,
                        year_text:   yr.text,
                    });
                }
            }
        }
        return results;
    }""")

    page.set_default_timeout(PAGE_TIMEOUT)
    print(f"  Found {len(combos)} family/model/year combinations.")
    return combos


# ── Phase 2: fetch PDF metadata via browser API ───────────────────────────

async def fetch_documents_via_browser(page, combo: dict) -> list[dict]:
    """
    Call GET /us/en/api/bikes/bike-documents from *within* the page using
    page.evaluate(fetch(...)). This is identical to what the site's own JS
    does when "Find Now" is clicked, so all cookies, Origin, and implicit
    browser headers are included automatically — no 403s.

    Retries up to API_MAX_RETRIES times on 429 with exponential backoff.
    Returns a flat list of {category, category_slug, filename, url} dicts.
    """
    url = (
        f"{API_BASE}"
        f"?family={combo['family_val']}"
        f"&model={quote(combo['model_val'])}"
        f"&year={quote(combo['year_val'])}"
    )

    for attempt in range(1, API_MAX_RETRIES + 1):
        status_and_body = await page.evaluate(
            """async (url) => {
                const resp = await fetch(url);
                if (resp.status === 429 || !resp.ok) {
                    return {status: resp.status, data: null};
                }
                return {status: resp.status, data: await resp.json()};
            }""",
            url,
        )
        status = status_and_body["status"]
        if status == 429:
            wait = 2 ** attempt + random.uniform(0, 2)
            print(
                f"  429 Too Many Requests — waiting {wait:.1f}s before retry "
                f"({attempt}/{API_MAX_RETRIES})",
                file=sys.stderr,
            )
            await asyncio.sleep(wait)
            continue
        if status != 200:
            raise RuntimeError(f"HTTP {status} for {url}")
        data = status_and_body["data"]
        break
    else:
        raise RuntimeError(f"429 persisted after {API_MAX_RETRIES} retries for {url}")

    if not data:
        return []

    docs = []
    for cat in data.get("categories", []) or []:
        if not cat:
            continue
        for doc in cat.get("documents", []) or []:
            if not doc:
                continue
            pdf_url = (doc.get("asset") or {}).get("url", "")
            if not pdf_url or not pdf_url.lower().endswith(".pdf"):
                continue
            docs.append({
                "category":      cat.get("title", ""),
                "category_slug": cat.get("slug", ""),
                "filename":      filename_from_url(pdf_url),
                "url":           pdf_url,
            })
    return docs


# ── Phase 3: download PDFs via httpx ─────────────────────────────────────

async def download_pdf(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    url: str,
    dest: Path,
) -> str:
    """
    Stream-download url → dest. Returns 'ok', 'skipped', or 'error'.
    Uses a .tmp sidecar during download so interrupted runs leave no partial
    files and the next run will retry cleanly.
    """
    if dest.exists():
        return "skipped"

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tmp")

    async with sem:
        try:
            async with client.stream("GET", url, timeout=DOWNLOAD_TIMEOUT) as resp:
                resp.raise_for_status()
                with tmp.open("wb") as fh:
                    async for chunk in resp.aiter_bytes(65_536):
                        fh.write(chunk)
            tmp.rename(dest)
            await asyncio.sleep(random.uniform(*DOWNLOAD_DELAY))
            return "ok"
        except Exception as exc:
            if tmp.exists():
                tmp.unlink(missing_ok=True)
            print(f"  ERROR downloading {url}: {exc}", file=sys.stderr)
            await asyncio.sleep(random.uniform(*DOWNLOAD_DELAY))
            return "error"


# ── Orchestration ──────────────────────────────────────────────────────────

async def run(
    output_dir: Path,
    headless: bool = True,
    refresh: bool = False,
    rebuild_combos: bool = False,
    rebuild_docs: bool = False,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "manifest.json"
    cache_path    = output_dir / COMBOS_CACHE_FILE
    docs_cache_path = output_dir / DOCS_CACHE_FILE

    manifest: dict = {}
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text())
        except Exception:
            manifest = {}

    # ── Browser phase: enumerate combos (if needed) + fetch all API metadata

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=headless)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="en-US",
        )
        page = await context.new_page()
        page.set_default_timeout(PAGE_TIMEOUT)

        await _navigate_and_init(page)

        # Load combo list from cache or enumerate fresh
        if cache_path.exists() and not rebuild_combos:
            combos: list[dict] = json.loads(cache_path.read_text())
            print(
                f"Loaded {len(combos)} combos from cache "
                f"({cache_path.name}). Use --rebuild-combos to refresh."
            )
        else:
            combos = await _enumerate_combos_js(page)
            cache_path.write_text(json.dumps(combos, indent=2, ensure_ascii=False))
            print(f"  Combo cache saved to {cache_path.name}")

        # Load partially-completed docs cache so a restart never re-hits
        # the API for combos we already fetched successfully.
        docs_cache: dict[str, list[dict]] = {}
        if docs_cache_path.exists() and not rebuild_docs:
            try:
                docs_cache = json.loads(docs_cache_path.read_text())
                print(
                    f"Loaded {len(docs_cache)} previously fetched doc lists "
                    f"from {docs_cache_path.name}."
                )
            except Exception:
                docs_cache = {}

        # Fetch PDF metadata for every combo that needs it, using the
        # browser's session so cookies are automatic.
        total = len(combos)
        # pending_downloads[combo_key] = list of doc dicts to download
        pending_downloads: dict[str, list[dict]] = {}

        for idx, combo in enumerate(combos, 1):
            combo_key   = combo["year_val"]
            family_name = combo["family_name"]
            model_name  = combo["model_name"]
            year_text   = combo["year_text"]

            in_manifest = combo_key in manifest and manifest[combo_key].get("files")

            if in_manifest and not refresh:
                entry    = manifest[combo_key]
                to_retry = [
                    info for info in entry["files"].values()
                    if info.get("status") == "error"
                    or (
                        info.get("status") == "ok"
                        and not (output_dir / info["path"]).exists()
                    )
                ]
                if not to_retry:
                    print(f"[{idx}/{total}] {model_name} {year_text} — complete")
                    continue
                print(
                    f"\n[{idx}/{total}] {model_name} {year_text} "
                    f"— retrying {len(to_retry)} file(s)"
                )
                # Use cached URLs; no API call needed
                pending_downloads[combo_key] = [
                    {
                        "category":      info["category"],
                        "category_slug": info["category_slug"],
                        "filename":      info["path"].split("/")[-1],
                        "url":           info["url"],
                    }
                    for info in to_retry
                ]
            else:
                # Check docs cache before hitting the API
                if combo_key in docs_cache and not refresh and not rebuild_docs:
                    docs = docs_cache[combo_key]
                    print(
                        f"[{idx}/{total}] {model_name} {year_text} "
                        f"— docs cached ({len(docs)} file(s))"
                    )
                else:
                    print(f"\n[{idx}/{total}] {family_name} / {model_name} / {year_text}")
                    try:
                        docs = await fetch_documents_via_browser(page, combo)
                    except Exception as exc:
                        print(f"  ERROR: API request failed — {exc}", file=sys.stderr)
                        print("  Stopping to avoid hammering the endpoint.")
                        manifest_path.write_text(
                            json.dumps(manifest, indent=2, ensure_ascii=False)
                        )
                        await browser.close()
                        return
                    # Save to docs cache immediately
                    docs_cache[combo_key] = docs
                    docs_cache_path.write_text(
                        json.dumps(docs_cache, indent=2, ensure_ascii=False)
                    )
                if not docs:
                    print("  No documents found.")
                else:
                    pending_downloads[combo_key] = docs

            # Ensure the combo entry exists in the manifest even if no docs
            manifest.setdefault(combo_key, {
                "family": family_name,
                "model":  model_name,
                "year":   year_text,
                "files":  {},
            })

        await browser.close()

    # ── Download phase: httpx (Contentful CDN, no session cookies needed) ──

    sem = asyncio.Semaphore(CONCURRENT_DL)
    async with httpx.AsyncClient(
        follow_redirects=True,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
        },
        timeout=30,
    ) as client:
        for combo in combos:
            combo_key   = combo["year_val"]
            family_name = combo["family_name"]
            model_name  = combo["model_name"]
            year_text   = combo["year_text"]

            docs = pending_downloads.get(combo_key)
            if not docs:
                continue

            dir_path = (
                output_dir
                / safe_name(family_name)
                / f"{safe_name(model_name)}_{year_text}"
            )

            combo_entry = manifest.setdefault(combo_key, {
                "family": family_name,
                "model":  model_name,
                "year":   year_text,
                "files":  {},
            })

            download_tasks = [
                (doc, asyncio.create_task(
                    download_pdf(client, sem, doc["url"], dir_path / doc["filename"])
                ))
                for doc in docs
            ]

            results = await asyncio.gather(*[task for _, task in download_tasks])

            for (doc, _), result in zip(download_tasks, results):
                dest = dir_path / doc["filename"]
                combo_entry["files"][doc["filename"]] = {
                    "url":           doc["url"],
                    "category":      doc["category"],
                    "category_slug": doc["category_slug"],
                    "path":          str(dest.relative_to(output_dir)),
                    "status":        result,
                }
                icon = {"ok": "✓", "skipped": "–", "error": "✗"}.get(result, "?")
                print(f"  {icon} [{doc['category']}] {doc['filename']}")

            manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))

    print(f"\nDone. Manifest saved to {manifest_path}")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Download Ducati owner's manuals and parts catalogs (US market)."
    )
    parser.add_argument(
        "--output-dir",
        default="./ducati_manuals",
        help="Directory to save PDFs (default: ./ducati_manuals)",
    )
    parser.add_argument(
        "--no-headless",
        action="store_true",
        help="Show the browser window (useful for debugging)",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help=(
            "Re-check the API for all combos even if already in the manifest "
            "(catches new document editions for existing models)"
        ),
    )
    parser.add_argument(
        "--rebuild-combos",
        action="store_true",
        help="Ignore the cached combo list and re-enumerate from the site",
    )
    parser.add_argument(
        "--rebuild-docs",
        action="store_true",
        help="Ignore the cached API responses and re-fetch document lists from the site",
    )
    args = parser.parse_args()

    asyncio.run(run(
        Path(args.output_dir),
        headless=not args.no_headless,
        refresh=args.refresh,
        rebuild_combos=args.rebuild_combos,
        rebuild_docs=args.rebuild_docs,
    ))


if __name__ == "__main__":
    main()
