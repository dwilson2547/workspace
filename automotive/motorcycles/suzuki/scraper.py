#!/usr/bin/env python3
# Site: Babbitts Suzuki Parts House
# Strategy: playwright-rendered  (Cloudflare blocks plain requests)
# Discovered endpoint / base URL: https://www.suzukipartshouse.com/oemparts/c/suzuki_motorcycle/parts
# Last recon: 2026-05-05
#
# URL hierarchy
# -------------
# /oemparts/c/suzuki_motorcycle/parts                            root (year list)
# /oemparts/c/suzuki_motorcycle_{YEAR}/parts                     year  → model list
# /oemparts/l/suz/{MODEL_ID}/{YEAR}-{MODEL_SLUG}-parts           model → diagram list
# /oemparts/a/suz/{ASSEMBLY_ID}/{DIAGRAM_SLUG}                   diagram → parts table
#
# SELECTORS dict at the top — update here when the site redesigns.

import logging
import random
import re
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

# ── Bootstrap: make local clients importable without installing them ──────────
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent

_WEBCACHE_CLIENT_DIR = _REPO_ROOT / "webcache" / "client"
if str(_WEBCACHE_CLIENT_DIR) not in sys.path:
    sys.path.insert(0, str(_WEBCACHE_CLIENT_DIR))

_IMGCACHE_CLIENT_DIR = _REPO_ROOT / "imgcache" / "client"
if str(_IMGCACHE_CLIENT_DIR) not in sys.path:
    sys.path.insert(0, str(_IMGCACHE_CLIENT_DIR))

from webcache_client import WebCacheClient      # noqa: E402
from imgcache_client import ImgCacheClient      # noqa: E402

from config import (                            # noqa: E402
    BASE_URL,
    CACHE_CLIENT_NAME,
    DELAY_MAX_SECONDS,
    DELAY_MIN_SECONDS,
    DOMAIN,
    IMGCACHE_URL,
    MAX_RETRIES,
    PAGE_TIMEOUT_MS,
    PART_DATA_DIR,
    RETRY_BACKOFF_SECONDS,
    ROOT_PARTS_URL,
    USER_AGENT,
    WAIT_FOR_SELECTOR_TIMEOUT_MS,
    WEBCACHE_URL,
    check_backoff,
    record_ban,
)
from db import (                                # noqa: E402
    Diagram,
    DiagramPart,
    Image,
    Motorcycle,
    Part,
    PartCategory,
    SessionFactory,
    init_db,
)

# ── Selectors ─────────────────────────────────────────────────────────────────

SELECTORS = {
    # Year listing page — links to /oemparts/c/suzuki_motorcycle_{YEAR}/parts
    "year_link":      "a[href*='/oemparts/c/suzuki_motorcycle_']",
    # Model listing page — links to /oemparts/l/suz/...
    "model_link":     "a[href*='/oemparts/l/suz/']",
    # Diagram listing page — links to /oemparts/a/suz/...
    "diagram_link":   "a[href*='/oemparts/a/suz/']",
    # Diagram page — the parts rows
    "part_row":       ".partlistrow",
    # Within a part row
    "ref_num":        ".c0 span",
    "part_name":      ".c1a span",
    "part_number":    ".itemnum",
    "price":          ".c2 .dbl",
    "qty_input":      "input[name='qty']",
    "part_url":       ".c1b a",
    # Diagram image
    "diagram_img":    "#diagram img",
    # Page title
    "page_h1":        "h1",
    # Selector that signals the diagram page is fully loaded
    "wait_for_parts": "#partlist",
    # Selector for model listing page (diagrams)
    "wait_for_diagrams": "a[href*='/oemparts/a/suz/']",
    # Selector for year listing (models)
    "wait_for_models": "a[href*='/oemparts/l/suz/']",
    # Selector for root (years)
    "wait_for_years": "a[href*='/oemparts/c/suzuki_motorcycle_']",
}

# ── Logging ───────────────────────────────────────────────────────────────────

_fmt = logging.Formatter("%(asctime)s %(levelname)-8s %(message)s")
_console = logging.StreamHandler(sys.stdout)
_console.setFormatter(_fmt)
logging.root.setLevel(logging.INFO)
logging.root.addHandler(_console)
logger = logging.getLogger(__name__)

# ── Graceful shutdown ─────────────────────────────────────────────────────────

_shutdown = False


def _handle_signal(signum: int, _frame) -> None:
    global _shutdown
    logger.warning("Signal %d received — will exit after current item.", signum)
    _shutdown = True


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT,  _handle_signal)


def check_shutdown() -> None:
    if _shutdown:
        logger.info("Graceful shutdown: exiting cleanly.")
        sys.exit(0)


# ── Page fetching (Playwright + webcache) ─────────────────────────────────────

def fetch_page(
    url: str,
    page,
    cache: WebCacheClient,
    wait_selector: str,
) -> str:
    """
    Return fully-rendered HTML for *url*.

    1. Checks webcache first — returns stored HTML immediately on hit.
    2. On miss: waits a random delay, navigates with Playwright, waits for
       *wait_selector*, stores the result in webcache, and returns the HTML.
    3. Retries up to MAX_RETRIES times with exponential back-off.
    """
    url = url.strip()

    try:
        cached = cache.get(url)
        if cached:
            logger.debug("[cache hit] %s", url)
            return cached["content"]
    except Exception as exc:
        logger.warning("Webcache GET failed for %s: %s", url, exc)

    delay = random.uniform(DELAY_MIN_SECONDS, DELAY_MAX_SECONDS)
    logger.info("[fetch] %s  (delay=%.1f s)", url, delay)
    time.sleep(delay)
    check_shutdown()

    last_exc: Optional[Exception] = None
    html = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = page.goto(url, wait_until="networkidle", timeout=PAGE_TIMEOUT_MS)
            if resp and resp.status == 429:
                retry_after = resp.headers.get("Retry-After")
                record_ban(retry_after)  # raises SystemExit
            if resp and resp.status == 403:
                logger.warning("403 on %s (attempt %d/%d)", url, attempt, MAX_RETRIES)
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_BACKOFF_SECONDS * attempt)
                    continue
                raise RuntimeError(f"403 Forbidden on {url}")
            page.wait_for_selector(wait_selector, timeout=WAIT_FOR_SELECTOR_TIMEOUT_MS)
            html = page.content()
            break
        except PlaywrightTimeout as exc:
            last_exc = exc
            logger.warning("Timeout on %s (attempt %d/%d)", url, attempt, MAX_RETRIES)
        except SystemExit:
            raise
        except Exception as exc:
            last_exc = exc
            logger.warning("Error fetching %s (attempt %d/%d): %s", url, attempt, MAX_RETRIES, exc)
        if attempt < MAX_RETRIES:
            time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    else:
        raise RuntimeError(
            f"Failed to fetch {url} after {MAX_RETRIES} attempts"
        ) from last_exc

    try:
        cache.store(url=url, content=html, client_name=CACHE_CLIENT_NAME)
    except Exception as exc:
        logger.warning("Webcache store failed for %s: %s", url, exc)

    return html


# ── Image caching via imgcache service ────────────────────────────────────────

def persist_image(
    image_url: str,
    http: httpx.Client,
    img_cache: ImgCacheClient,
    db_session,
) -> Optional[int]:
    """
    Download *image_url* and store it in the imgcache service.
    Inserts or retrieves an Image row and returns its DB id.
    Returns None on failure.
    """
    if not image_url:
        return None

    # Check local DB first (avoids imgcache roundtrip on repeats)
    existing = db_session.query(Image).filter_by(source_url=image_url).first()
    if existing:
        return existing.id

    # Check imgcache for previously stored image
    try:
        meta = img_cache.lookup(image_url)
        if meta:
            content_hash = meta["content_hash"]
            img_row = db_session.query(Image).filter_by(content_hash=content_hash).first()
            if img_row:
                return img_row.id
            img_row = Image(content_hash=content_hash, source_url=image_url)
            db_session.add(img_row)
            db_session.flush()
            return img_row.id
    except Exception as exc:
        logger.warning("ImgCache lookup failed for %s: %s", image_url, exc)

    # Download and store
    try:
        resp = http.get(image_url, timeout=30)
        resp.raise_for_status()
        img_bytes = resp.content
    except Exception as exc:
        logger.warning("Image download failed (%s): %s", image_url, exc)
        return None

    try:
        filename = image_url.rsplit("/", 1)[-1].split("?")[0] or "diagram.png"
        result = img_cache.store(
            url=image_url,
            file_bytes=img_bytes,
            client_name=CACHE_CLIENT_NAME,
            filename=filename,
        )
        content_hash = result["content_hash"]
    except Exception as exc:
        logger.warning("ImgCache store failed for %s: %s", image_url, exc)
        return None

    img_row = Image(content_hash=content_hash, source_url=image_url)
    db_session.add(img_row)
    db_session.flush()
    return img_row.id


# ── URL helpers ───────────────────────────────────────────────────────────────

def extract_year_from_url(url: str) -> Optional[str]:
    """Extract year string from a year-level URL like /oemparts/c/suzuki_motorcycle_2024/parts."""
    m = re.search(r"suzuki_motorcycle_(\d{4})", url)
    return m.group(1) if m else None


def extract_model_external_id(url: str) -> Optional[str]:
    """Extract the hex model ID from /oemparts/l/suz/{ID}/..."""
    m = re.search(r"/oemparts/l/suz/([a-f0-9]+)/", url)
    return m.group(1) if m else None


def extract_assembly_id(url: str) -> Optional[str]:
    """Extract the hex assembly ID from /oemparts/a/suz/{ID}/..."""
    m = re.search(r"/oemparts/a/suz/([a-f0-9]+)/", url)
    return m.group(1) if m else None


def abs_url(href: str) -> str:
    """Convert a relative href to an absolute URL."""
    if href.startswith("http"):
        return href
    return BASE_URL + href


# ── Extraction helpers (BeautifulSoup) ────────────────────────────────────────

def extract_year_urls(html: str) -> list[str]:
    """Parse the root page and return all year-level URLs."""
    soup = BeautifulSoup(html, "lxml")
    urls = []
    for a in soup.select(SELECTORS["year_link"]):
        href = a.get("href", "")
        if href and "/oemparts/c/suzuki_motorcycle_" in href:
            urls.append(abs_url(href))
    return list(dict.fromkeys(urls))  # deduplicate preserving order


def extract_model_links(html: str) -> list[dict]:
    """
    Parse a year page and return a list of dicts:
      {"url": ..., "link_text": ...}
    """
    soup = BeautifulSoup(html, "lxml")
    results = []
    for a in soup.select(SELECTORS["model_link"]):
        href = a.get("href", "")
        if href and "/oemparts/l/suz/" in href:
            results.append({
                "url": abs_url(href),
                "link_text": a.get_text(strip=True),
            })
    return results


def extract_diagram_links(html: str) -> list[dict]:
    """
    Parse a model page and return a list of dicts:
      {"url": ..., "title": ...}
    """
    soup = BeautifulSoup(html, "lxml")
    results = []
    for a in soup.select(SELECTORS["diagram_link"]):
        href = a.get("href", "")
        if href and "/oemparts/a/suz/" in href:
            results.append({
                "url": abs_url(href),
                "title": a.get_text(strip=True),
            })
    return results


def extract_model_name_from_html(html: str) -> Optional[str]:
    """Get the full model name from the h1 of the model listing page."""
    soup = BeautifulSoup(html, "lxml")
    h1 = soup.select_one(SELECTORS["page_h1"])
    if h1:
        text = h1.get_text(strip=True)
        # Remove trailing " OEM Parts" if present
        text = re.sub(r"\s+OEM\s+Parts$", "", text, flags=re.IGNORECASE).strip()
        return text
    return None


def extract_parts_from_html(html: str) -> list[dict]:
    """
    Parse the diagram page and return all parts as a list of dicts:
      {ref_num, part_number, part_name, price, quantity, part_url}
    """
    soup = BeautifulSoup(html, "lxml")
    parts = []
    for row in soup.select(SELECTORS["part_row"]):
        # ref number
        ref_el = row.select_one(SELECTORS["ref_num"])
        ref_num = ref_el.get_text(strip=True) if ref_el else ""

        # part name (from c1a span)
        name_el = row.select_one(SELECTORS["part_name"])
        part_name = name_el.get_text(strip=True) if name_el else ""

        # part number (from .itemnum inside a link)
        num_el = row.select_one(SELECTORS["part_number"])
        part_number = num_el.get_text(strip=True) if num_el else ""

        # Also try data-sku on the form as fallback
        form = row.find("form")
        if not part_number and form:
            part_number = form.get("data-sku", "").strip()
        if not part_name and form:
            part_name = form.get("data-name", "").strip()

        # price
        price_el = row.select_one(SELECTORS["price"])
        price = price_el.get_text(strip=True) if price_el else ""

        # default quantity
        qty_el = row.select_one(SELECTORS["qty_input"])
        qty = 1
        if qty_el:
            try:
                qty = int(qty_el.get("value", "1").strip())
            except ValueError:
                qty = 1

        # part detail URL
        part_link = row.select_one(SELECTORS["part_url"])
        part_url = abs_url(part_link["href"]) if part_link and part_link.get("href") else ""

        if part_number:  # skip rows with no part number (spacer rows)
            parts.append({
                "ref_num":     ref_num,
                "part_number": part_number,
                "part_name":   part_name,
                "price":       price,
                "quantity":    qty,
                "part_url":    part_url,
            })

    return parts


def extract_diagram_image_url(html: str) -> Optional[str]:
    """Extract the diagram image src from the page HTML."""
    soup = BeautifulSoup(html, "lxml")
    img = soup.select_one(SELECTORS["diagram_img"])
    return img.get("src") if img else None


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_or_create_category(name: str, session) -> PartCategory:
    cat = session.query(PartCategory).filter_by(name=name).first()
    if not cat:
        cat = PartCategory(name=name)
        session.add(cat)
        session.flush()
    return cat


def get_or_create_part(
    part_number: str,
    part_name: str,
    price: str,
    part_url: str,
    session,
) -> Part:
    part = session.query(Part).filter_by(part_number=part_number).first()
    if not part:
        part = Part(
            part_number=part_number,
            name=part_name,
            price=price,
            part_url=part_url,
        )
        session.add(part)
        session.flush()
    return part


# ── Core scraping logic ───────────────────────────────────────────────────────

def scrape_diagram(
    diagram_url: str,
    diagram_title: str,
    motorcycle: Motorcycle,
    pw_page,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    http: httpx.Client,
    session,
) -> None:
    """
    Fetch a single diagram page and persist:
    - The Diagram record
    - The diagram image (via imgcache)
    - All DiagramPart + Part records
    - motorcycle_diagrams and motorcycle_parts associations
    """
    check_shutdown()

    # Skip if already scraped
    existing = session.query(Diagram).filter_by(source_url=diagram_url).first()
    if existing and existing.scraped_at:
        logger.info("[skip] diagram already scraped: %s", diagram_url)
        # Still link motorcycle if not already linked
        if motorcycle not in existing.motorcycles:
            existing.motorcycles.append(motorcycle)
            session.commit()
        return

    assembly_id = extract_assembly_id(diagram_url)

    html = fetch_page(
        diagram_url, pw_page, cache,
        wait_selector=SELECTORS["wait_for_parts"],
    )

    # Image
    img_url = extract_diagram_image_url(html)
    image_id = persist_image(img_url, http, img_cache, session) if img_url else None

    # Category (use diagram title as category name)
    category = get_or_create_category(diagram_title, session)

    # Diagram record
    diagram = session.query(Diagram).filter_by(source_url=diagram_url).first()
    if not diagram:
        diagram = Diagram(
            external_id = assembly_id,
            title       = diagram_title,
            category_id = category.id,
            image_id    = image_id,
            source_url  = diagram_url,
        )
        session.add(diagram)
        session.flush()

    # Link motorcycle ↔ diagram
    if motorcycle not in diagram.motorcycles:
        diagram.motorcycles.append(motorcycle)

    # Parts
    parts_data = extract_parts_from_html(html)
    logger.info("  diagram '%s': %d parts", diagram_title, len(parts_data))

    for p in parts_data:
        part = get_or_create_part(
            p["part_number"], p["part_name"], p["price"], p["part_url"], session
        )

        # DiagramPart association
        existing_dp = session.query(DiagramPart).filter_by(
            diagram_id=diagram.id, part_id=part.id
        ).first()
        if not existing_dp:
            dp = DiagramPart(
                diagram_id = diagram.id,
                part_id    = part.id,
                ref_num    = p["ref_num"],
                quantity   = p["quantity"],
            )
            session.add(dp)

        # motorcycle_parts association
        if motorcycle not in part.motorcycles:
            part.motorcycles.append(motorcycle)

    # Mark diagram scraped
    diagram.scraped_at = datetime.now(timezone.utc)
    if image_id:
        diagram.image_id = image_id
    session.commit()


def scrape_motorcycle(
    model_url: str,
    year: str,
    model_code: str,
    pw_page,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    http: httpx.Client,
    session,
) -> None:
    """
    Fetch the model page, extract all diagram links, and scrape each diagram.
    """
    check_shutdown()

    external_id = extract_model_external_id(model_url)

    # Upsert motorcycle record
    mc = session.query(Motorcycle).filter_by(year=year, model_code=model_code).first()
    if not mc:
        mc = Motorcycle(
            year        = year,
            model_code  = model_code,
            external_id = external_id,
            source_url  = model_url,
        )
        session.add(mc)
        session.flush()

    if mc.scraped_at:
        logger.info("[skip] motorcycle already scraped: %s %s", year, model_code)
        return

    html = fetch_page(
        model_url, pw_page, cache,
        wait_selector=SELECTORS["wait_for_diagrams"],
    )

    # Backfill model_name if missing
    if not mc.model_name:
        mc.model_name = extract_model_name_from_html(html)
        session.flush()

    diagram_links = extract_diagram_links(html)
    logger.info("motorcycle %s %s: %d diagrams", year, model_code, len(diagram_links))

    for dl in diagram_links:
        check_shutdown()
        try:
            scrape_diagram(
                diagram_url   = dl["url"],
                diagram_title = dl["title"],
                motorcycle    = mc,
                pw_page       = pw_page,
                cache         = cache,
                img_cache     = img_cache,
                http          = http,
                session       = session,
            )
        except Exception as exc:
            logger.error("Failed to scrape diagram %s: %s", dl["url"], exc)
            session.rollback()

    mc.scraped_at = datetime.now(timezone.utc)
    session.commit()
    logger.info("[done] motorcycle %s %s", year, model_code)


def scrape_year(
    year_url: str,
    year: str,
    pw_page,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    http: httpx.Client,
    session,
) -> None:
    """Fetch a year page and scrape every model found on it."""
    check_shutdown()

    html = fetch_page(
        year_url, pw_page, cache,
        wait_selector=SELECTORS["wait_for_models"],
    )

    model_links = extract_model_links(html)
    logger.info("year %s: %d models", year, len(model_links))

    for ml in model_links:
        check_shutdown()
        model_code  = ml["link_text"].strip()
        model_url   = ml["url"]
        try:
            scrape_motorcycle(
                model_url  = model_url,
                year       = year,
                model_code = model_code,
                pw_page    = pw_page,
                cache      = cache,
                img_cache  = img_cache,
                http       = http,
                session    = session,
            )
        except Exception as exc:
            logger.error("Failed to scrape model %s %s: %s", year, model_code, exc)
            session.rollback()


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    check_backoff()
    PART_DATA_DIR.mkdir(parents=True, exist_ok=True)
    init_db()

    # Add file log handler
    log_file = PART_DATA_DIR / "scraper.log"
    fh = logging.FileHandler(log_file, encoding="utf-8")
    fh.setFormatter(_fmt)
    logging.root.addHandler(fh)

    cache     = WebCacheClient(WEBCACHE_URL)
    img_cache = ImgCacheClient(IMGCACHE_URL)

    with SessionFactory() as session:
        with httpx.Client(
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
            timeout=30.0,
        ) as http:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent=USER_AGENT,
                    viewport={"width": 1280, "height": 900},
                    locale="en-US",
                )

                # Intercept 429 responses from the browser
                def handle_response(response) -> None:
                    if response.status == 429:
                        retry_after = response.headers.get("Retry-After")
                        record_ban(retry_after)  # raises SystemExit

                context.on("response", handle_response)
                pw_page = context.new_page()

                try:
                    # ── Step 1: get year list ──────────────────────────────────
                    logger.info("Fetching root page: %s", ROOT_PARTS_URL)
                    root_html = fetch_page(
                        ROOT_PARTS_URL, pw_page, cache,
                        wait_selector=SELECTORS["wait_for_years"],
                    )
                    year_urls = extract_year_urls(root_html)
                    logger.info("Found %d years to scrape", len(year_urls))

                    for year_url in year_urls:
                        check_shutdown()
                        year = extract_year_from_url(year_url) or "unknown"
                        try:
                            scrape_year(
                                year_url  = year_url,
                                year      = year,
                                pw_page   = pw_page,
                                cache     = cache,
                                img_cache = img_cache,
                                http      = http,
                                session   = session,
                            )
                        except Exception as exc:
                            logger.error("Failed to scrape year %s: %s", year, exc)

                finally:
                    browser.close()

    logger.info("Scrape complete.")


if __name__ == "__main__":
    main()
