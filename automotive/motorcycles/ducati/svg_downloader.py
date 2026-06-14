"""
svg_downloader.py
-----------------
Downloads SVG pages for Issuu catalogs that have no PDF Download button
(i.e., rows where no_download_btn_at IS NOT NULL and local_path IS NULL).

For each qualifying catalog:
1. Navigates to the Issuu URL via Playwright to intercept the reader4.json
   request made by the viewer, which contains all per-page svgUrl values.
2. Creates  part_catalogs/{slug}/  as the output directory.
3. Downloads all SVGs concurrently via aiohttp (they live on S3, no auth).
4. Sets local_path to the folder path so subsequent runs skip this catalog.

Usage:
    python svg_downloader.py
"""

import asyncio
import logging
import re
import random
from pathlib import Path

import aiohttp
from playwright.async_api import async_playwright, Page

from config import CATALOGS_DIR, DELAY_MIN_SECONDS, DELAY_MAX_SECONDS
from db import get_session, init_db, Catalog, mark_downloaded

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# Delay range (seconds) between individual SVG fetches to avoid rate limiting
SVG_DELAY_MIN = 1.0
SVG_DELAY_MAX = 3.0

# Timeout (seconds) for a single SVG fetch
SVG_FETCH_TIMEOUT = 30


# ── Helpers ───────────────────────────────────────────────────────────────────


def _reader4_url(issuu_url: str) -> str | None:
    """Derive the publication.issuu.com reader4.json URL from an Issuu doc URL."""
    m = re.match(r"https?://issuu\.com/([^/]+)/docs/([^/?#]+)", issuu_url)
    if not m:
        return None
    return f"https://publication.issuu.com/{m.group(1)}/{m.group(2)}/reader4.json"


def _slug_from_url(issuu_url: str) -> str:
    """Extract the document slug (last path segment) from an Issuu URL."""
    m = re.match(r"https?://issuu\.com/[^/]+/docs/([^/?#]+)", issuu_url)
    return m.group(1) if m else "unknown"


def _jitter() -> float:
    return random.uniform(DELAY_MIN_SECONDS, DELAY_MAX_SECONDS)


# ── Issuu SVG URL discovery ───────────────────────────────────────────────────


async def get_svg_urls(page: Page, issuu_url: str) -> list[str]:
    """
    Navigate to *issuu_url* and intercept the reader4.json network response to
    collect all per-page svgUrl strings.

    Returns an empty list if the JSON cannot be obtained or has no pages.
    """
    target = _reader4_url(issuu_url)
    if not target:
        log.warning("Cannot derive reader4 URL from: %s", issuu_url)
        return []

    svg_urls: list[str] = []
    captured = asyncio.Event()

    async def on_response(response):
        if target in response.url and not captured.is_set():
            try:
                data = await response.json()
                pages = data.get("document", {}).get("pages", [])
                svg_urls.extend(p["svgUrl"] for p in pages if "svgUrl" in p)
                captured.set()
            except Exception as exc:
                log.debug("Failed to parse reader4 JSON: %s", exc)

    page.on("response", on_response)
    try:
        log.info("  → Loading Issuu page: %s", issuu_url)
        await page.goto(issuu_url, wait_until="networkidle", timeout=90_000)
        # Give a little extra time for the iframe to fire the reader4 request
        if not captured.is_set():
            try:
                await asyncio.wait_for(captured.wait(), timeout=15)
            except asyncio.TimeoutError:
                log.warning("  reader4.json not seen for %s", issuu_url)
    finally:
        page.remove_listener("response", on_response)

    return svg_urls


# ── Concurrent SVG download ───────────────────────────────────────────────────


async def _download_svg(
    session: aiohttp.ClientSession,
    url: str,
    dest: Path,
) -> int:
    """Download one SVG; return bytes written (0 on failure)."""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=SVG_FETCH_TIMEOUT)) as resp:
            resp.raise_for_status()
            data = await resp.read()
            dest.write_bytes(data)
            return len(data)
    except Exception as exc:
        log.warning("  Failed to download %s: %s", url, exc)
        return 0


async def download_all_svgs(svg_urls: list[str], out_dir: Path) -> int:
    """
    Download all SVGs into *out_dir* one at a time with a random delay between
    each request (SVG_DELAY_MIN–SVG_DELAY_MAX seconds) to avoid rate limiting.
    Returns total bytes written.
    """
    out_dir.mkdir(parents=True, exist_ok=True)

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
    }

    total = 0
    saved = 0
    async with aiohttp.ClientSession(headers=headers) as http:
        for idx, url in enumerate(svg_urls):
            filename = url.split("/")[-1]
            dest = out_dir / filename
            bytes_written = await _download_svg(http, url, dest)
            total += bytes_written
            if bytes_written > 0:
                saved += 1
            # Polite delay between every request except the last
            if idx < len(svg_urls) - 1:
                await asyncio.sleep(random.uniform(SVG_DELAY_MIN, SVG_DELAY_MAX))

    log.info("  ✓ %d/%d SVGs saved (%d bytes total)", saved, len(svg_urls), total)
    return total


# ── Catalog queries ───────────────────────────────────────────────────────────


def get_pending_catalogs() -> list[dict]:
    """Return catalogs that need SVG download (no_download_btn_at set, local_path null)."""
    with get_session() as session:
        rows = (
            session.query(Catalog)
            .filter(
                Catalog.no_download_btn_at.isnot(None),
                Catalog.local_path.is_(None),
            )
            .order_by(Catalog.year, Catalog.model_family, Catalog.model_name)
            .all()
        )
        return [
            {
                "id": r.id,
                "year": r.year,
                "family": r.model_family or "",
                "name": r.model_name,
                "url": r.issuu_url,
            }
            for r in rows
        ]


# ── Main ──────────────────────────────────────────────────────────────────────


async def run():
    CATALOGS_DIR.mkdir(parents=True, exist_ok=True)
    init_db()

    pending = get_pending_catalogs()
    log.info("%d catalogs need SVG download.", len(pending))
    if not pending:
        return

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
        )
        context.set_default_timeout(90_000)

        for i, item in enumerate(pending, 1):
            log.info(
                "[%d/%d] %s %s – %s",
                i,
                len(pending),
                item["year"],
                item["family"],
                item["name"],
            )

            slug = _slug_from_url(item["url"])
            out_dir = CATALOGS_DIR / slug

            # Skip if already has SVGs on disk (e.g. partial previous run)
            existing = list(out_dir.glob("page_*.svg")) if out_dir.exists() else []

            page = await context.new_page()
            try:
                svg_urls = await get_svg_urls(page, item["url"])
            finally:
                await page.close()

            if not svg_urls:
                log.warning("  No SVG URLs found for %s – skipping.", item["url"])
                if i < len(pending):
                    await asyncio.sleep(_jitter())
                continue

            log.info("  %d pages to download → %s/", len(svg_urls), out_dir.name)

            # If a previous partial run exists, skip already-downloaded pages
            if existing:
                done_names = {f.name for f in existing}
                svg_urls = [u for u in svg_urls if u.split("/")[-1] not in done_names]
                log.info("  Resuming: %d pages remaining.", len(svg_urls))

            total_bytes = await download_all_svgs(svg_urls, out_dir)

            if total_bytes > 0:
                with get_session() as session:
                    mark_downloaded(session, item["id"], str(out_dir), total_bytes)
                    session.commit()
                log.info("  DB updated for catalog_id=%d.", item["id"])

            if i < len(pending):
                delay = _jitter()
                log.debug("  Waiting %.1f s …", delay)
                await asyncio.sleep(delay)

        await browser.close()

    log.info("SVG downloader finished.")


if __name__ == "__main__":
    asyncio.run(run())
