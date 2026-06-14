"""
scraper.py
----------
1. Visits ducatiomaha.com and extracts every Issuu catalog link with its
   year, model-family, and model name.
2. Upserts catalog metadata into PostgreSQL.
3. For catalogs that have never been downloaded—or were last downloaded more
   than REDOWNLOAD_THRESHOLD_DAYS ago—navigates to Issuu, clicks the Download
   button inside the reader iframe, and saves the file to ./part_catalogs/.

Usage:
    python scraper.py
"""

import asyncio
import logging
import random
import re
from pathlib import Path

from playwright.async_api import async_playwright, Page, BrowserContext

from config import (
    SOURCE_URL,
    CATALOGS_DIR,
    REDOWNLOAD_THRESHOLD_DAYS,
    DELAY_MIN_SECONDS,
    DELAY_MAX_SECONDS,
    DOWNLOAD_MAX_RETRIES,
    DOWNLOAD_BACKOFF_BASE_SECONDS,
)
from db import get_session, init_db, upsert_catalog, mark_downloaded, mark_no_download_button, needs_download

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Catalog link extraction ───────────────────────────────────────────────────

# JavaScript run in the browser to extract every (year, family, model, url)
# combination from the ducatiomaha parts page.
_EXTRACT_JS = """
() => {
    const results = [];
    const seen = new Set();

    // All anchor tags pointing to issuu.com/ducatiomaha/docs/
    const links = Array.from(
        document.querySelectorAll('a[href*="issuu.com/ducatiomaha/docs/"]')
    );

    for (const link of links) {
        // Strip query-string tracking parameters from the URL
        let url;
        try {
            const u = new URL(link.href);
            url = u.origin + u.pathname;
        } catch (_) {
            continue;
        }
        if (seen.has(url)) continue;
        seen.add(url);

        const modelName = link.textContent.trim();

        // --- find model family: last non-empty text node before this link ---
        let modelFamily = '';
        let sib = link.previousSibling;
        while (sib) {
            if (sib.nodeType === Node.TEXT_NODE) {
                const t = sib.textContent
                    .trim()
                    .replace(/^[,\\s]+/, '')        // leading commas/spaces
                    .replace(/\\s*[-\\u2013\\u2014]\\s*$/, '') // trailing dash/em-dash
                    .trim();
                if (t) { modelFamily = t; break; }
            }
            sib = sib.previousSibling;
        }

        // --- find year: walk up/back looking for an element whose text is a 4-digit year ---
        let year = '';
        let el = link;
        outer:
        while (el) {
            const parent = el.parentElement;
            if (!parent) break;
            const children = Array.from(parent.childNodes);
            const myIdx = children.indexOf(el);
            for (let i = myIdx - 1; i >= 0; i--) {
                const t = (children[i].textContent || '').trim();
                if (/^\\d{4}$/.test(t)) { year = t; break outer; }
            }
            el = parent;
        }

        // Fallback: parse year from the Issuu document slug
        if (!year) {
            const m = url.match(/_(20\\d{2})_/);
            if (m) year = m[1];
        }

        results.push({ year: year || '0', modelFamily, modelName, url });
    }

    return results;
}
"""


async def scrape_catalog_links(page: Page) -> list[dict]:
    """Return list of {year, modelFamily, modelName, url} dicts."""
    log.info("Loading %s …", SOURCE_URL)
    await page.goto(SOURCE_URL, wait_until="networkidle", timeout=60_000)
    catalogs = await page.evaluate(_EXTRACT_JS)
    log.info("Found %d catalog links.", len(catalogs))
    return catalogs


# ── Issuu PDF download ────────────────────────────────────────────────────────


def _jitter_delay() -> float:
    """Return a random delay in [DELAY_MIN_SECONDS, DELAY_MAX_SECONDS]."""
    return random.uniform(DELAY_MIN_SECONDS, DELAY_MAX_SECONDS)


async def _attempt_download(context: BrowserContext, issuu_url: str, output_path: Path) -> bool | None:
    """
    Single attempt: open a fresh page, navigate to the Issuu viewer, click the
    Download button inside the reader iframe, save the file.
    Returns:
        True  – file saved successfully
        None  – no Download button present (skip, do not retry)
        False – transient error (caller should retry with back-off)
    """
    page = await context.new_page()
    try:
        log.info("  → Navigating to Issuu: %s", issuu_url)
        await page.goto(issuu_url, wait_until="networkidle", timeout=90_000)

        # Dismiss cookie/consent dialog if present
        try:
            ok_btn = page.get_by_role("button", name=re.compile(r"^ok$", re.I))
            if await ok_btn.count() > 0:
                await ok_btn.first.click()
                await page.wait_for_timeout(random.randint(400, 800))
        except Exception:
            pass

        # Human-like pause before looking for the Download button
        await page.wait_for_timeout(random.randint(2_500, 4_500))

        # The Download button lives inside the Issuu reader iframe.
        # Try every iframe on the page until we find one with the button.
        reader_frame = None
        for frame in page.frames:
            if frame == page.main_frame:
                continue
            try:
                btn = frame.get_by_role("button", name="Download")
                if await btn.count() > 0:
                    reader_frame = frame
                    break
            except Exception:
                continue

        if reader_frame is None:
            # Fall back: look for the button in the main frame (some embed styles)
            btn = page.get_by_role("button", name="Download")
            if await btn.count() == 0:
                log.warning("  ✗ No Download button found for %s", issuu_url)
                return None  # not a transient error – don't retry
            reader_frame = page

        download_btn = reader_frame.get_by_role("button", name="Download")

        # Small random pause before clicking to mimic a human reading the page
        await page.wait_for_timeout(random.randint(800, 2_000))
        log.info("  → Clicking Download …")
        async with page.expect_download(timeout=120_000) as dl_info:
            await download_btn.first.click()

        download = await dl_info.value
        suggested = download.suggested_filename or output_path.name
        final_path = output_path.with_suffix(Path(suggested).suffix or ".pdf")

        await download.save_as(str(final_path))
        log.info("  ✓ Saved to %s (%d bytes)", final_path.name, final_path.stat().st_size)
        return True

    except Exception as exc:
        log.warning("  ✗ Attempt failed for %s: %s", issuu_url, exc)
        return False
    finally:
        await page.close()


async def download_issuu_pdf(
    context: BrowserContext, issuu_url: str, output_path: Path
) -> bool | None:
    """
    Download a single Issuu document with exponential back-off + jitter.
    Retries up to DOWNLOAD_MAX_RETRIES times on transient failures.

    Returns:
        True  – file saved successfully
        None  – no Download button present (caller should flag the row)
        False – all retries exhausted
    """
    for attempt in range(1, DOWNLOAD_MAX_RETRIES + 1):
        result = await _attempt_download(context, issuu_url, output_path)
        if result is True:
            return True
        if result is None:
            # No download button – propagate so caller can persist the flag
            return None
        # result is False – transient error, back off and retry
        if attempt < DOWNLOAD_MAX_RETRIES:
            backoff = DOWNLOAD_BACKOFF_BASE_SECONDS * (2 ** (attempt - 1))
            jitter = random.uniform(0, backoff * 0.3)  # ±30 % jitter
            wait = backoff + jitter
            log.warning(
                "  Retry %d/%d in %.1f s …", attempt, DOWNLOAD_MAX_RETRIES, wait
            )
            await asyncio.sleep(wait)
    log.error("  ✗ All %d attempts failed for %s", DOWNLOAD_MAX_RETRIES, issuu_url)
    return False


# ── Filename helpers ──────────────────────────────────────────────────────────


def safe_filename(year: str, model_family: str, model_name: str) -> str:
    """Produce a filesystem-safe base filename."""
    parts = [str(year)]
    if model_family:
        parts.append(model_family)
    parts.append(model_name)
    name = "_".join(parts)
    name = re.sub(r"[^\w\s-]", "", name)
    name = re.sub(r"[\s]+", "_", name)
    return name[:120]  # cap length


# ── Main ──────────────────────────────────────────────────────────────────────


async def run():
    CATALOGS_DIR.mkdir(parents=True, exist_ok=True)
    init_db()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            accept_downloads=True,
        )
        context.set_default_timeout(90_000)

        # ── Step 1: scrape catalog list ───────────────────────────────────
        page = await context.new_page()
        raw_catalogs = await scrape_catalog_links(page)
        await page.close()

        # ── Step 2: upsert metadata; decide what needs downloading ────────
        to_download: list[dict] = []  # {catalog_id, year, family, name, url, path}

        with get_session() as session:
            for item in raw_catalogs:
                year_int = int(item["year"]) if item["year"].isdigit() else 0
                catalog_id = upsert_catalog(
                    session,
                    year_int,
                    item["modelFamily"],
                    item["modelName"],
                    item["url"],
                )
                session.commit()

                should_dl, _ = needs_download(
                    session, item["url"], REDOWNLOAD_THRESHOLD_DAYS
                )
                if should_dl:
                    fname = safe_filename(
                        item["year"], item["modelFamily"], item["modelName"]
                    )
                    # Avoid clobbering an existing file with the same base name
                    # (can happen when two Issuu URLs share the same year/family/name).
                    candidate = CATALOGS_DIR / f"{fname}.pdf"
                    counter = 2
                    while candidate.exists():
                        candidate = CATALOGS_DIR / f"{fname}_{counter}.pdf"
                        counter += 1
                    to_download.append(
                        {
                            "catalog_id": catalog_id,
                            "year": item["year"],
                            "family": item["modelFamily"],
                            "name": item["modelName"],
                            "url": item["url"],
                            "path": candidate,
                        }
                    )

        log.info(
            "%d catalogs need downloading (out of %d total).",
            len(to_download),
            len(raw_catalogs),
        )

        # ── Step 3: download PDFs ─────────────────────────────────────────
        for i, item in enumerate(to_download, 1):
            log.info(
                "[%d/%d] %s %s – %s",
                i,
                len(to_download),
                item["year"],
                item["family"],
                item["name"],
            )

            result = await download_issuu_pdf(context, item["url"], item["path"])

            if result is True:
                # Find the actual saved file (extension may differ from .pdf)
                saved_files = list(CATALOGS_DIR.glob(item["path"].stem + ".*"))
                if saved_files:
                    saved = saved_files[0]
                    with get_session() as session:
                        mark_downloaded(
                            session,
                            item["catalog_id"],
                            str(saved),
                            saved.stat().st_size,
                        )
                        session.commit()
            elif result is None:
                # Issuu has no Download button – flag the row so we skip it next run
                with get_session() as session:
                    mark_no_download_button(session, item["catalog_id"])
                    session.commit()
                log.info("  Flagged catalog_id=%d as no-download-button.", item["catalog_id"])

            # Jittered polite delay between Issuu requests
            if i < len(to_download):
                delay = _jitter_delay()
                log.debug("  Waiting %.1f s before next request …", delay)
                await asyncio.sleep(delay)

        await browser.close()

    log.info("Scraper finished.")


if __name__ == "__main__":
    asyncio.run(run())
