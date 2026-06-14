#!/usr/bin/env python3
"""
Aprilia Genuine Parts Scraper
==============================
Crawls https://aprilia.genuine-parts-catalogue.com and persists all part
diagrams and parts to a local SQLite database.

Key behaviours
--------------
* Every visited page is cached in the WebCache service (http://localhost:8000).
  On subsequent runs the cache is checked first so Playwright is only launched
  for pages not yet seen.
* Diagram images are downloaded once, SHA-256 content-addressed and saved to
  part_data/images/.  Multiple diagrams that share the same image (identical
  bytes) point to the same Image record.
* The scraper is intentionally slow (5–12 s random delay per page) to stay
  well under any rate-limit threshold.
* SIGTERM and keyboard interrupt trigger a graceful shutdown: the current item
  finishes writing before the process exits.
* Progress is tracked via scraped_at fields in the database.  Re-running the
  scraper skips already-completed diagrams and motorcycles.

URL hierarchy
-------------
/aprilia-motorcycle                                          (main page — lists all)
/aprilia-motorcycle/{cc}-APRILIA-{TYPE}                     depth 2  displacement
/aprilia-motorcycle/{cc}-APRILIA-{TYPE}/{MODEL}             depth 3  model
/aprilia-motorcycle/{cc}-APRILIA-{TYPE}/{MODEL}/{YEAR}      depth 4  year
/aprilia-motorcycle/…/{YEAR}/{TRIM_NAME}/{trim_id}          depth 6  trim catalogue
/aprilia-motorcycle/…/{TRIM_NAME}/{CAT}/{SUB}/{mid}/{i}/{did}/{tid}  depth 11  diagram
"""

import hashlib
import logging
import random
import re
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, NavigableString
from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

# ── Bootstrap: make the webcache client importable without installing it ──────
_WEBCACHE_CLIENT_DIR = Path(__file__).resolve().parent.parent.parent / "webcache" / "client"
if str(_WEBCACHE_CLIENT_DIR) not in sys.path:
    sys.path.insert(0, str(_WEBCACHE_CLIENT_DIR))

from webcache_client import WebCacheClient  # noqa: E402  (after sys.path patch)

from config import (  # noqa: E402
    BASE_URL,
    CACHE_CLIENT_NAME,
    DELAY_MAX_SECONDS,
    DELAY_MIN_SECONDS,
    DISPLACEMENT_TYPE_MAP,
    IMAGES_DIR,
    MAIN_PAGE_URL,
    MAX_RETRIES,
    PART_DATA_DIR,
    RETRY_BACKOFF_SECONDS,
    USER_AGENT,
    WEBCACHE_URL,
)
from db import (  # noqa: E402
    Category,
    Diagram,
    DiagramPart,
    Image,
    Motorcycle,
    Part,
    SessionFactory,
    init_db,
)


# ── Logging ───────────────────────────────────────────────────────────────────
# Console handler set up immediately; file handler added in main() after mkdir.

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
    """Exit cleanly if a shutdown signal has been received."""
    if _shutdown:
        logger.info("Graceful shutdown: exiting cleanly.")
        sys.exit(0)


# ── Page fetching with webcache ───────────────────────────────────────────────

def fetch_page(url: str, cache: WebCacheClient, page) -> str:
    """
    Return the fully-rendered HTML for *url*.

    Checks the webcache first.  On a cache miss, navigates with Playwright
    (after a randomised delay), stores the result in the cache, and returns it.
    Retries up to MAX_RETRIES times with exponential back-off on network errors.
    """
    url = url.strip()

    # Cache check
    try:
        cached = cache.get(url)
        if cached:
            logger.debug("[cache] %s", url)
            return cached["content"]
    except Exception as exc:
        logger.warning("Webcache GET failed for %s: %s", url, exc)

    # Live fetch via Playwright
    delay = random.uniform(DELAY_MIN_SECONDS, DELAY_MAX_SECONDS)
    logger.info("[fetch] %s  (delay=%.1f s)", url, delay)
    time.sleep(delay)
    check_shutdown()

    last_exc: Optional[Exception] = None
    html = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            page.goto(url, wait_until="networkidle", timeout=60_000)
            html = page.content()
            break
        except PlaywrightTimeout as exc:
            last_exc = exc
            logger.warning("Timeout on %s (attempt %d/%d)", url, attempt, MAX_RETRIES)
        except Exception as exc:
            last_exc = exc
            logger.warning("Error fetching %s (attempt %d/%d): %s", url, attempt, MAX_RETRIES, exc)
        if attempt < MAX_RETRIES:
            time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    else:
        raise RuntimeError(
            f"Failed to fetch {url} after {MAX_RETRIES} attempts"
        ) from last_exc

    # Store in webcache (best-effort)
    try:
        cache.store(url=url, content=html, client_name=CACHE_CLIENT_NAME)
    except Exception as exc:
        logger.warning("Webcache store failed for %s: %s", url, exc)

    return html


# ── Image download & deduplication ───────────────────────────────────────────

def persist_image(
    image_url: str, http: httpx.Client, session
) -> Optional[int]:
    """
    Download *image_url*, compute its SHA-256 hash, and:
      • return the existing Image.id if the same bytes are already stored, or
      • write the file to IMAGES_DIR, insert an Image row, and return the new id.
    Returns None on download failure (does not raise).
    """
    if not image_url:
        return None
    try:
        resp = http.get(image_url, timeout=30)
        resp.raise_for_status()
        data = resp.content
    except Exception as exc:
        logger.warning("Image download failed (%s): %s", image_url, exc)
        return None

    sha = hashlib.sha256(data).hexdigest()

    existing = session.query(Image).filter_by(sha256=sha).first()
    if existing:
        logger.debug("Image dedup: %s… already stored (id=%d)", sha[:8], existing.id)
        return existing.id

    ext = image_url.rsplit(".", 1)[-1].split("?")[0].lower() or "webp"
    local_path = IMAGES_DIR / f"{sha}.{ext}"
    local_path.write_bytes(data)

    img = Image(sha256=sha, local_path=str(local_path), source_url=image_url)
    session.add(img)
    session.flush()
    logger.debug("Saved image %s… → %s", sha[:8], local_path.name)
    return img.id


# ── URL / HTML helpers ────────────────────────────────────────────────────────

def _abs(href: str) -> str:
    href = href.strip()
    return href if href.startswith("http") else urljoin(BASE_URL, href)


def extract_links_at_depth(
    html: str,
    base_path: str,
    depth: int,
    numeric_last: bool = False,
) -> list[str]:
    """
    Return unique absolute URLs whose URL path:
      • starts with *base_path*  (e.g. '/aprilia-motorcycle/50-APRILIA-MOTORCYCLES/')
      • has exactly *depth* path segments  (number of '/' in the path, ignoring
        the leading slash, i.e. '/a/b/c' → depth 3)
    If *numeric_last* is True only URLs whose last path segment is an integer
    are returned.
    """
    soup = BeautifulSoup(html, "lxml")
    seen: set[str] = set()
    result: list[str] = []

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href == "#":
            continue
        full = _abs(href)
        if not full.startswith(BASE_URL):
            continue

        path = urlparse(full).path.rstrip("/")
        if not path.startswith(base_path.rstrip("/")):
            continue
        # path.split("/") → ['', seg1, seg2, …]; subtract 1 for leading ''
        parts = path.split("/")
        if len(parts) - 1 != depth:
            continue
        if numeric_last and not parts[-1].isdigit():
            continue
        if full not in seen:
            seen.add(full)
            result.append(full)

    return result


def get_displacement_urls(html: str) -> list[str]:
    """
    Extract all displacement-group URLs from the main motorcycle page.
    These look like /aprilia-motorcycle/{cc}-APRILIA-{TYPE}.
    Utility pages like /aprilia-motorcycle/price are excluded.
    """
    soup = BeautifulSoup(html, "lxml")
    seen: set[str] = set()
    result: list[str] = []

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href.startswith("/aprilia-motorcycle/"):
            continue
        parts = href.split("/")          # ['', 'aprilia-motorcycle', '{slug}']
        if len(parts) != 3:
            continue
        slug = parts[2]
        # Valid displacement slugs contain '-APRILIA-' (e.g. '50-APRILIA-MOTORCYCLES')
        if "-APRILIA-" not in slug:
            continue
        full = _abs(href)
        if full not in seen:
            seen.add(full)
            result.append(full)

    return result


def vehicle_type_from_slug(disp_slug: str) -> str:
    """'660-APRILIA-MOTORCYCLES' → 'Motorcycle'"""
    for key, label in DISPLACEMENT_TYPE_MAP.items():
        if disp_slug.endswith(key):
            return label
    return "Unknown"


def displacement_cc_from_slug(disp_slug: str) -> str:
    """'660-APRILIA-MOTORCYCLES' → '660'"""
    return disp_slug.split("-")[0]


def parse_diagram_page(html: str) -> dict:
    """
    Parse a parts-diagram page and return::

        {
          'image_url': str | None,
          'parts': [
            { 'index': str, 'part_number': str, 'name': str,
              'price': str, 'quantity': int }
          ]
        }

    The diagram image URL is taken directly from the <img> inside
    .card_parts_image so it can be downloaded separately.

    Each part row in #card-body contains:
      - callout index  (col-etape7 element)
      - part number    (span.JS_ref_link, or span[itemprop=mpn] fallback)
      - name           (span[itemprop=name], minus the part-number line)
      - price          (.prix-etape7, first non-empty line)
      - quantity       (input[name=qte_table_parts] value, default 1)
    """
    soup = BeautifulSoup(html, "lxml")

    # Diagram image
    img_el    = soup.select_one(".card_parts_image img")
    image_url = img_el.get("src") if img_el else None

    # Parts list
    card_body = soup.find(id="card-body")
    parts: list[dict] = []

    if not card_body:
        return {"image_url": image_url, "parts": parts}

    for child in card_body.children:
        if isinstance(child, NavigableString):
            continue
        if "d-flex" not in (child.get("class") or []):
            continue

        # ── Index (callout number) ────────────────────────────────────────────
        index_col = child.find(class_=re.compile(r"col-etape7"))
        index = index_col.get_text(strip=True) if index_col else ""

        # ── Part number ───────────────────────────────────────────────────────
        ref_span = child.find("span", class_="JS_ref_link")
        if not ref_span:
            mpn_outer = child.find("span", itemprop="mpn")
            ref_span  = mpn_outer.find("span") if mpn_outer else None
        part_number = ref_span.get_text(strip=True) if ref_span else ""
        if not part_number:
            continue   # skip rows with no identifiable OEM number

        # ── Name ──────────────────────────────────────────────────────────────
        name_span = child.find("span", itemprop="name")
        name = ""
        if name_span:
            raw_lines = name_span.get_text(separator="\n", strip=True).split("\n")
            name = " ".join(
                ln.strip() for ln in raw_lines
                if ln.strip() and ln.strip() != part_number
            )

        # ── Price ─────────────────────────────────────────────────────────────
        price_el = child.find(class_=re.compile(r"prix-etape7"))
        price = ""
        if price_el:
            for ln in price_el.get_text(separator="\n", strip=True).split("\n"):
                if ln.strip():
                    price = ln.strip()
                    break

        # ── Quantity (default order qty = parts per assembly) ─────────────────
        qty_input = child.find("input", attrs={"name": "qte_table_parts"})
        quantity = 1
        if qty_input:
            try:
                quantity = int(qty_input.get("value", 1))
            except (ValueError, TypeError):
                quantity = 1

        parts.append({
            "index":       index,
            "part_number": part_number,
            "name":        name,
            "price":       price,
            "quantity":    quantity,
        })

    return {"image_url": image_url, "parts": parts}


# ── Database helpers ──────────────────────────────────────────────────────────

def upsert_motorcycle(
    session, *, vehicle_type, displacement, model, year,
    trim_name, trim_id, model_id, source_url,
) -> Motorcycle:
    moto = session.query(Motorcycle).filter_by(
        vehicle_type=vehicle_type,
        displacement=displacement,
        model=model,
        year=year,
        trim_id=trim_id,
    ).first()
    if moto:
        return moto
    moto = Motorcycle(
        vehicle_type=vehicle_type,
        displacement=displacement,
        model=model,
        year=year,
        trim_name=trim_name,
        trim_id=trim_id,
        model_id=model_id,
        source_url=source_url,
    )
    session.add(moto)
    session.flush()
    return moto


def upsert_category(session, name: str) -> Category:
    cat = session.query(Category).filter_by(name=name).first()
    if not cat:
        cat = Category(name=name)
        session.add(cat)
        session.flush()
    return cat


def upsert_part(session, part_number: str, name: str) -> Part:
    part = session.query(Part).filter_by(part_number=part_number).first()
    if not part:
        part = Part(part_number=part_number, name=name)
        session.add(part)
        session.flush()
    return part


# ── Diagram-level scraping ────────────────────────────────────────────────────

def _diagram_meta_from_url(url: str) -> dict:
    """
    Parse the URL path of a diagram page into its structural components.

    Path form (depth 11):
        /{vtype}/{disp}/{model}/{year}/{trim_name}/{category}/{sub}/{mid}/{idx}/{did}/{tid}
    indices after split('/'):
        0=''  1=vtype  2=disp  3=model  4=year  5=trim_name
        6=category  7=sub  8=mid  9=idx  10=did  11=tid
    """
    parts = urlparse(url).path.rstrip("/").split("/")
    if len(parts) < 12:
        return {}
    return {
        "category": parts[6].replace("-", " "),
        "title":    parts[7].replace("-", " "),
        "model_id": int(parts[8])  if parts[8].isdigit()  else 0,
        "trim_id":  int(parts[11]) if parts[11].isdigit() else 0,
    }


def scrape_diagram(
    url: str,
    moto: Motorcycle,
    session,
    cache: WebCacheClient,
    page,
    http: httpx.Client,
) -> None:
    """
    Scrape a single diagram page.

    • Downloads and deduplicates the diagram image.
    • Persists all parts and their diagram-position data.
    • Links the diagram and its parts to the Motorcycle record.
    • No-op if the diagram already has a scraped_at timestamp.
    """
    existing = session.query(Diagram).filter_by(source_url=url).first()
    if existing and existing.scraped_at:
        logger.debug("Already scraped: %s", url)
        return

    meta = _diagram_meta_from_url(url)
    if not meta:
        logger.warning("Could not parse diagram URL structure: %s", url)
        return

    try:
        html = fetch_page(url, cache, page)
    except Exception as exc:
        logger.error("Skipping diagram %s: %s", url, exc)
        return

    data = parse_diagram_page(html)
    cat  = upsert_category(session, meta["category"])

    # Image (failure is non-fatal); resolve relative URLs against the base host
    image_id = persist_image(_abs(data["image_url"]) if data["image_url"] else "", http, session)

    # Upsert diagram record
    if existing:
        existing.image_id   = image_id
        existing.scraped_at = datetime.now(timezone.utc)
        diagram = existing
    else:
        diagram = Diagram(
            title       = meta["title"],
            category_id = cat.id,
            image_id    = image_id,
            source_url  = url,
            scraped_at  = datetime.now(timezone.utc),
        )
        session.add(diagram)
        session.flush()

    # Associate diagram → motorcycle
    if moto not in diagram.motorcycles:
        diagram.motorcycles.append(moto)

    # Parts — track (diagram_id, part_id) pairs added this pass to guard
    # against the same part appearing at multiple indices in one diagram.
    seen_dp: set[tuple[int, int]] = set()
    # Pre-populate with any already-persisted links for this diagram.
    for existing_dp in session.query(DiagramPart).filter_by(diagram_id=diagram.id).all():
        seen_dp.add((existing_dp.diagram_id, existing_dp.part_id))

    for p in data["parts"]:
        part = upsert_part(session, p["part_number"], p["name"])

        key = (diagram.id, part.id)
        if key not in seen_dp:
            seen_dp.add(key)
            session.add(DiagramPart(
                diagram_id = diagram.id,
                part_id    = part.id,
                part_index = p["index"],
                quantity   = p["quantity"],
            ))

        if part not in moto.parts:
            moto.parts.append(part)

    session.commit()

    logger.info(
        "    ✓ [%s] %s — %d parts%s",
        meta["category"],
        meta["title"],
        len(data["parts"]),
        "" if data["image_url"] else " (no image)",
    )


# ── Trim-level scraping ───────────────────────────────────────────────────────

def scrape_trim(
    trim_url: str,
    vehicle_type: str,
    displacement: str,
    model: str,
    year: int,
    session,
    cache: WebCacheClient,
    page,
    http: httpx.Client,
) -> None:
    """
    Scrape all diagram pages for a single trim.
    Creates / retrieves the Motorcycle record, discovers all diagram URLs
    from the trim catalogue page, and delegates each to scrape_diagram().
    Sets motorcycle.scraped_at once all diagrams are done.
    """
    url_parts  = urlparse(trim_url).path.rstrip("/").split("/")
    trim_name  = url_parts[-2].replace("-", " ")
    try:
        trim_id = int(url_parts[-1])
    except ValueError:
        logger.warning("Could not parse trim_id from %s — skipping", trim_url)
        return

    moto = upsert_motorcycle(
        session,
        vehicle_type = vehicle_type,
        displacement = displacement,
        model        = model,
        year         = year,
        trim_name    = trim_name,
        trim_id      = trim_id,
        model_id     = 0,
        source_url   = trim_url,
    )
    session.commit()

    if moto.scraped_at:
        logger.debug("Trim already fully scraped: %s", trim_url)
        return

    try:
        html = fetch_page(trim_url, cache, page)
    except Exception as exc:
        logger.error("Skipping trim %s: %s", trim_url, exc)
        return

    # Diagram links share the trim NAME prefix (not the trim ID segment)
    # e.g.  /aprilia-motorcycle/50-APRILIA-MOTORCYCLES/RS/2010/RS-50/
    #                                                   ↑ trim name, not ID
    diagram_base = "/".join(url_parts[:-1]) + "/"   # drop /{trim_id}, add /
    diagram_urls = extract_links_at_depth(html, diagram_base, depth=11)

    if not diagram_urls:
        logger.warning("No diagram links found for %s", trim_url)
        return

    # Backfill model_id from first diagram URL
    first_meta = _diagram_meta_from_url(diagram_urls[0])
    if first_meta.get("model_id"):
        moto.model_id = first_meta["model_id"]
        session.commit()

    logger.info(
        "  %s | %s %dcc | %d %s | %d diagrams",
        vehicle_type, model, int(displacement) if displacement.isdigit() else 0,
        year, trim_name, len(diagram_urls),
    )

    for diag_url in diagram_urls:
        check_shutdown()
        scrape_diagram(diag_url, moto, session, cache, page, http)

    moto.scraped_at = datetime.now(timezone.utc)
    session.commit()


# ── Main orchestrator ─────────────────────────────────────────────────────────

def main() -> None:
    # Ensure output directories exist before opening the log file
    PART_DATA_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # Add file log handler now that the directory exists
    fh = logging.FileHandler(PART_DATA_DIR / "scraper.log")
    fh.setFormatter(_fmt)
    logging.root.addHandler(fh)

    init_db()

    # Verify webcache is reachable before starting
    cache = WebCacheClient(WEBCACHE_URL)
    try:
        cache.health()
    except Exception as exc:
        logger.error("WebCache not reachable at %s: %s", WEBCACHE_URL, exc)
        sys.exit(1)

    logger.info("=== Aprilia scraper starting ===")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        bpage   = browser.new_page()
        bpage.set_extra_http_headers({"Accept-Language": "en-GB,en;q=0.9"})

        with httpx.Client(
            headers={"User-Agent": USER_AGENT}, follow_redirects=True
        ) as http:
            with SessionFactory() as session:

                # ── Step 1: enumerate all displacement groups ─────────────────
                logger.info("Fetching main page: %s", MAIN_PAGE_URL)
                main_html = fetch_page(MAIN_PAGE_URL, cache, bpage)
                disp_urls = get_displacement_urls(main_html)
                logger.info("Found %d displacement groups", len(disp_urls))

                for disp_url in disp_urls:
                    check_shutdown()

                    disp_slug    = disp_url.rstrip("/").split("/")[-1]
                    displacement = displacement_cc_from_slug(disp_slug)
                    vehicle_type = vehicle_type_from_slug(disp_slug)

                    logger.info("── %s %s cc ──", vehicle_type, displacement)

                    # ── Step 2: models ────────────────────────────────────────
                    try:
                        disp_html = fetch_page(disp_url, cache, bpage)
                    except Exception as exc:
                        logger.error("Skipping displacement %s: %s", disp_url, exc)
                        continue

                    disp_path  = urlparse(disp_url).path.rstrip("/")
                    model_urls = extract_links_at_depth(
                        disp_html, disp_path + "/", depth=3
                    )
                    logger.info("  %d models", len(model_urls))

                    for model_url in model_urls:
                        check_shutdown()

                        model = model_url.rstrip("/").split("/")[-1]
                        logger.info("  Model: %s", model)

                        # ── Step 3: years ─────────────────────────────────────
                        try:
                            model_html = fetch_page(model_url, cache, bpage)
                        except Exception as exc:
                            logger.error("Skipping model %s: %s", model_url, exc)
                            continue

                        model_path = urlparse(model_url).path.rstrip("/")
                        year_urls  = [
                            u for u in extract_links_at_depth(
                                model_html, model_path + "/", depth=4
                            )
                            if (seg := u.rstrip("/").split("/")[-1]).isdigit()
                            and len(seg) == 4
                        ]

                        for year_url in year_urls:
                            check_shutdown()

                            year = int(year_url.rstrip("/").split("/")[-1])
                            logger.info("  Year: %d", year)

                            # ── Step 4: trims ─────────────────────────────────
                            try:
                                year_html = fetch_page(year_url, cache, bpage)
                            except Exception as exc:
                                logger.error("Skipping year %s: %s", year_url, exc)
                                continue

                            year_path = urlparse(year_url).path.rstrip("/")
                            trim_urls = extract_links_at_depth(
                                year_html,
                                year_path + "/",
                                depth=6,
                                numeric_last=True,
                            )

                            for trim_url in trim_urls:
                                check_shutdown()
                                scrape_trim(
                                    trim_url     = trim_url,
                                    vehicle_type = vehicle_type,
                                    displacement = displacement,
                                    model        = model,
                                    year         = year,
                                    session      = session,
                                    cache        = cache,
                                    page         = bpage,
                                    http         = http,
                                )

        browser.close()

    logger.info("=== Scraping complete ===")


if __name__ == "__main__":
    main()
