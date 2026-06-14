#!/usr/bin/env python3
"""
Kawasaki Parts Scraper
======================
Crawls https://www.kawasaki.com/en-us/owner-center/parts and persists all
part diagrams and parts to a local SQLite database.

Key behaviours
--------------
* The Kawasaki site is server-rendered: all data is extracted with httpx +
  BeautifulSoup — no headless browser is required.
* A session cookie (ASPSESID) is obtained by visiting the main page and is
  refreshed every SESSION_REFRESH_INTERVAL seconds to prevent expiry during
  long runs.
* Two JSON API endpoints enumerate all vehicle categories, years and model
  codes; their responses are cached in the WebCache service to avoid redundant
  round-trips on restart.
* Every HTML page visited is cached in WebCache (http://localhost:8000).
  On subsequent runs the cache is checked first so HTTP is only used for
  pages not yet seen.
* Diagram images are downloaded once, SHA-256 content-addressed, and saved to
  part_data/images/.  Identical images (same bytes) share one Image row.
* Scraping is intentionally slow (2–5 s random delay per page) to stay well
  under any rate-limit threshold.
* SIGTERM and keyboard interrupt trigger a graceful shutdown: the current item
  finishes writing before the process exits.
* Progress is tracked via scraped_at timestamps.  Re-running the scraper
  skips already-completed motorcycles and diagrams.

URL hierarchy
-------------
  Enumeration (JSON API — POST):
    /en-us/ownercenter/PartsAjaxModelYears   → years per category
    /en-us/ownercenter/PartsAjaxProducts     → model codes per category + year

  HTML pages:
    /en-us/owner-center/parts/{year}/{model_code}                 — diagram list
    /en-us/owner-center/parts/{diagram_id}/{year}/{model_code}    — diagram + parts
"""

import hashlib
import json
import logging
import random
import re
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
from bs4 import BeautifulSoup

# ── Bootstrap: make the webcache client importable ───────────────────────────
_WEBCACHE_CLIENT_DIR = (
    Path(__file__).resolve().parent.parent.parent / "webcache" / "client"
)
if str(_WEBCACHE_CLIENT_DIR) not in sys.path:
    sys.path.insert(0, str(_WEBCACHE_CLIENT_DIR))

from webcache_client import WebCacheClient  # noqa: E402

from config import (  # noqa: E402
    AJAX_HEADERS,
    AJAX_PRODUCTS_URL,
    AJAX_YEARS_URL,
    BASE_URL,
    CACHE_BUCKET,
    CACHE_CLIENT_NAME,
    CATEGORIES,
    DELAY_MAX_SECONDS,
    DELAY_MIN_SECONDS,
    IMAGES_DIR,
    MAIN_PAGE_URL,
    MAX_RETRIES,
    PAGE_HEADERS,
    PART_DATA_DIR,
    RETRY_BACKOFF_SECONDS,
    SESSION_REFRESH_INTERVAL,
    USER_AGENT,
    WEBCACHE_URL,
)
from db import (  # noqa: E402
    Diagram,
    DiagramPart,
    Image,
    Motorcycle,
    Part,
    PartCategory,
    SessionFactory,
    init_db,
)

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
    """Exit cleanly if a shutdown signal has been received."""
    if _shutdown:
        logger.info("Graceful shutdown: exiting cleanly.")
        sys.exit(0)


# ── Session management ────────────────────────────────────────────────────────

class KawasakiSession:
    """
    Manages a persistent httpx.Client with an active ASPSESID session cookie.

    The session is automatically refreshed if it has been idle longer than
    SESSION_REFRESH_INTERVAL seconds or when a request returns unexpected HTML
    instead of JSON (sign that the session has expired).
    """

    def __init__(self) -> None:
        self._client: Optional[httpx.Client] = None
        self._last_refresh: float = 0.0

    def _build_client(self) -> httpx.Client:
        client = httpx.Client(
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
            timeout=30.0,
        )
        return client

    def _refresh(self) -> None:
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
        self._client = self._build_client()
        logger.info("Establishing session (visiting main page)…")
        try:
            self._client.get(MAIN_PAGE_URL, headers=PAGE_HEADERS, timeout=20)
        except Exception as exc:
            logger.warning("Session refresh request failed: %s", exc)
        self._last_refresh = time.monotonic()

    def _ensure_fresh(self) -> None:
        if (
            self._client is None
            or time.monotonic() - self._last_refresh > SESSION_REFRESH_INTERVAL
        ):
            self._refresh()

    def get(self, url: str) -> httpx.Response:
        self._ensure_fresh()
        return self._client.get(url, headers=PAGE_HEADERS, timeout=30)

    def post_ajax(self, url: str, data: dict) -> httpx.Response:
        """POST to an AJAX endpoint; refreshes session and retries once on failure."""
        self._ensure_fresh()
        r = self._client.post(url, data=data, headers=AJAX_HEADERS, timeout=15)
        # Detect session expiry: server returns full HTML page instead of JSON
        if "application/json" not in r.headers.get("content-type", ""):
            logger.warning("Session appears expired — refreshing and retrying…")
            self._refresh()
            r = self._client.post(url, data=data, headers=AJAX_HEADERS, timeout=15)
        return r

    def close(self) -> None:
        if self._client:
            self._client.close()


# ── Webcache-aware fetchers ───────────────────────────────────────────────────

def fetch_page(url: str, session: KawasakiSession, cache: WebCacheClient) -> str:
    """
    Return the rendered HTML for *url*.

    1. Checks WebCache first.
    2. On a cache miss: fetches with httpx (after a random delay), stores in
       cache, and returns the HTML.
    3. Retries up to MAX_RETRIES times with exponential back-off on errors.
    """
    url = url.strip()

    try:
        cached = cache.get(url, bucket=CACHE_BUCKET)
        if cached:
            logger.debug("[cache hit] %s", url)
            return cached["content"]
    except Exception as exc:
        logger.warning("WebCache GET failed for %s: %s", url, exc)

    delay = random.uniform(DELAY_MIN_SECONDS, DELAY_MAX_SECONDS)
    logger.info("[fetch] %s  (delay=%.1f s)", url, delay)
    time.sleep(delay)
    check_shutdown()

    last_exc: Optional[Exception] = None
    html = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = session.get(url)
            r.raise_for_status()
            html = r.text
            break
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
        cache.store(url=url, content=html, client_name=CACHE_CLIENT_NAME, bucket=CACHE_BUCKET)
    except Exception as exc:
        logger.warning("WebCache store failed for %s: %s", url, exc)

    return html


def fetch_json_api(
    ajax_url: str,
    post_data: dict,
    cache_key: str,
    session: KawasakiSession,
    cache: WebCacheClient,
) -> list:
    """
    Call a JSON AJAX endpoint (POST) and return the parsed list.

    Caches the JSON response body under *cache_key* so re-runs are instant.
    """
    try:
        cached = cache.get(cache_key, bucket=CACHE_BUCKET)
        if cached:
            logger.debug("[cache hit] %s", cache_key)
            return json.loads(cached["content"])
    except Exception as exc:
        logger.warning("WebCache GET failed for %s: %s", cache_key, exc)

    delay = random.uniform(DELAY_MIN_SECONDS, DELAY_MAX_SECONDS)
    logger.debug("[api] %s  (delay=%.1f s)", cache_key, delay)
    time.sleep(delay)
    check_shutdown()

    last_exc: Optional[Exception] = None
    data: list = []
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = session.post_ajax(ajax_url, post_data)
            r.raise_for_status()
            data = r.json()
            break
        except Exception as exc:
            last_exc = exc
            logger.warning("API error %s (attempt %d/%d): %s", cache_key, attempt, MAX_RETRIES, exc)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    else:
        raise RuntimeError(
            f"Failed to call API {ajax_url} after {MAX_RETRIES} attempts"
        ) from last_exc

    try:
        cache.store(url=cache_key, content=json.dumps(data), client_name=CACHE_CLIENT_NAME, bucket=CACHE_BUCKET)
    except Exception as exc:
        logger.warning("WebCache store failed for %s: %s", cache_key, exc)

    return data


# ── Image download & deduplication ───────────────────────────────────────────

def persist_image(
    image_url: str,
    http: httpx.Client,
    db_session,
) -> Optional[int]:
    """
    Download *image_url*, compute SHA-256, and:
      • return the existing Image.id if the same bytes are already stored, or
      • write the file to IMAGES_DIR, insert an Image row, return the new id.
    Returns None on download failure (non-fatal).
    """
    if not image_url:
        return None

    # Strip query-string parameters (e.g. ?w=350 thumbnail sizing)
    clean_url = image_url.split("?")[0]
    if not clean_url.startswith("http"):
        clean_url = BASE_URL + clean_url

    try:
        r = http.get(clean_url, timeout=30)
        r.raise_for_status()
        data = r.content
    except Exception as exc:
        logger.warning("Image download failed (%s): %s", clean_url, exc)
        return None

    sha = hashlib.sha256(data).hexdigest()

    existing = db_session.query(Image).filter_by(sha256=sha).first()
    if existing:
        logger.debug("Image dedup: %s… already stored (id=%d)", sha[:8], existing.id)
        return existing.id

    ext = clean_url.rsplit(".", 1)[-1].lower() or "gif"
    local_path = IMAGES_DIR / f"{sha}.{ext}"
    local_path.write_bytes(data)

    img = Image(sha256=sha, local_path=str(local_path), source_url=clean_url)
    db_session.add(img)
    db_session.flush()
    logger.debug("Saved image %s… → %s", sha[:8], local_path.name)
    return img.id


# ── HTML parsers ──────────────────────────────────────────────────────────────

_DIAG_HREF_RE = re.compile(r"/en-us/owner-center/parts/(\d+)/([^/]+)/([^/]+)$")


def parse_diagram_cards(html: str) -> list[dict]:
    """
    Parse the motorcycle categories page and return a list of diagram card dicts::

        [
            {
                'href':        '/en-us/owner-center/parts/309879/2020/EX400HLF',
                'external_id': 309879,
                'title':       'Cowling',
                'image_url':   '/Content/Images/Parts/.../F2871.GIF?w=350',
            },
            …
        ]
    """
    soup = BeautifulSoup(html, "lxml")
    seen: set[str] = set()
    cards: list[dict] = []

    for a in soup.find_all("a", href=_DIAG_HREF_RE):
        href: str = a["href"]
        if href in seen:
            continue
        seen.add(href)

        m = _DIAG_HREF_RE.search(href)
        external_id = int(m.group(1)) if m else 0

        # Title is in the nearest <h3> within the same card container
        card = a.find_parent("div") or a.find_parent("li")
        title = ""
        image_url = ""
        if card:
            h3 = card.find("h3")
            title = h3.get_text(strip=True) if h3 else ""
            img = card.find("img")
            image_url = img.get("src", "") if img else ""

        cards.append(
            {
                "href":        href,
                "external_id": external_id,
                "title":       title,
                "image_url":   image_url,
            }
        )

    return cards


def parse_diagram_page(html: str) -> dict:
    """
    Parse a single parts-diagram page and return::

        {
            'image_url': str | None,
            'parts': [
                {
                    'name':        str,
                    'ref_num':     str,   # REF # column (callout number)
                    'part_number': str,
                    'quantity':    int,
                    'destination': str,
                    'remarks':     str,
                }
            ]
        }

    The parts table on Kawasaki's site has a <caption>Part Item Information</caption>
    with columns: ITEM NAME | REF # | PART NUMBER | QUANTITY | DESTINATION | REMARKS.
    """
    soup = BeautifulSoup(html, "lxml")

    # Diagram image (full-resolution, no ?w= parameter needed)
    img_tag = soup.find("img", src=lambda s: s and "Content/Images/Parts" in s)
    image_url = img_tag.get("src", "") if img_tag else ""

    # Parts table — find by caption text
    parts: list[dict] = []
    target_table = None
    for t in soup.find_all("table"):
        cap = t.find("caption")
        if cap and "Part Item Information" in cap.get_text():
            target_table = t
            break

    if target_table is None:
        return {"image_url": image_url, "parts": parts}

    for row in target_table.find_all("tr"):
        cells = row.find_all(["td", "th"])
        if len(cells) < 3:
            continue
        texts = [c.get_text(strip=True) for c in cells]

        # Skip the header row
        if texts[0].upper() == "ITEM NAME":
            continue

        name        = texts[0]
        ref_num     = texts[1] if len(texts) > 1 else ""
        part_number = texts[2] if len(texts) > 2 else ""
        quantity_raw = texts[3] if len(texts) > 3 else "1"
        destination = texts[4] if len(texts) > 4 else ""
        remarks     = texts[5] if len(texts) > 5 else ""

        if not part_number:
            continue  # skip rows without an OEM part number

        try:
            quantity = int(quantity_raw)
        except (ValueError, TypeError):
            quantity = 1

        parts.append(
            {
                "name":        name,
                "ref_num":     ref_num,
                "part_number": part_number,
                "quantity":    quantity,
                "destination": destination,
                "remarks":     remarks,
            }
        )

    return {"image_url": image_url, "parts": parts}


# ── Database helpers ──────────────────────────────────────────────────────────

def upsert_motorcycle(
    db_session,
    *,
    category_id: int,
    category_name: str,
    year: str,
    model_code: str,
    model_name: str,
    source_url: str,
) -> Motorcycle:
    moto = (
        db_session.query(Motorcycle)
        .filter_by(year=year, model_code=model_code)
        .first()
    )
    if moto:
        return moto
    moto = Motorcycle(
        category_id=category_id,
        category_name=category_name,
        year=year,
        model_code=model_code,
        model_name=model_name,
        source_url=source_url,
    )
    db_session.add(moto)
    db_session.flush()
    return moto


def upsert_part_category(db_session, name: str) -> PartCategory:
    cat = db_session.query(PartCategory).filter_by(name=name).first()
    if not cat:
        cat = PartCategory(name=name)
        db_session.add(cat)
        db_session.flush()
    return cat


def upsert_part(db_session, part_number: str, name: str) -> Part:
    part = db_session.query(Part).filter_by(part_number=part_number).first()
    if not part:
        part = Part(part_number=part_number, name=name)
        db_session.add(part)
        db_session.flush()
    return part


# ── Diagram-level scraping ────────────────────────────────────────────────────

def scrape_diagram(
    card: dict,
    moto: Motorcycle,
    db_session,
    session: KawasakiSession,
    cache: WebCacheClient,
    http: httpx.Client,
) -> None:
    """
    Scrape a single diagram page identified by *card* (from parse_diagram_cards).

    • Downloads and deduplicates the diagram image.
    • Persists all parts and their diagram-position metadata.
    • Links the diagram and its parts to the Motorcycle record.
    • No-op if the diagram already has a scraped_at timestamp.
    """
    url = card["href"]
    if not url.startswith("http"):
        url = BASE_URL + url

    existing = db_session.query(Diagram).filter_by(source_url=url).first()
    if existing and existing.scraped_at:
        logger.debug("Already scraped diagram: %s", url)
        return

    try:
        html = fetch_page(url, session, cache)
    except Exception as exc:
        logger.error("Skipping diagram %s: %s", url, exc)
        return

    data = parse_diagram_page(html)

    cat  = upsert_part_category(db_session, card["title"] or "Unknown")
    image_id = persist_image(data["image_url"], http, db_session)

    if existing:
        existing.image_id  = image_id
        existing.scraped_at = datetime.now(timezone.utc)
        diagram = existing
    else:
        diagram = Diagram(
            external_id = card["external_id"],
            title       = card["title"],
            category_id = cat.id,
            image_id    = image_id,
            source_url  = url,
            scraped_at  = datetime.now(timezone.utc),
        )
        db_session.add(diagram)
        db_session.flush()

    if moto not in diagram.motorcycles:
        diagram.motorcycles.append(moto)

    # Guard against duplicate (diagram_id, part_id) pairs within this diagram
    seen_dp: set[tuple[int, int]] = set()
    for existing_dp in db_session.query(DiagramPart).filter_by(diagram_id=diagram.id).all():
        seen_dp.add((existing_dp.diagram_id, existing_dp.part_id))

    for p in data["parts"]:
        part = upsert_part(db_session, p["part_number"], p["name"])

        key = (diagram.id, part.id)
        if key not in seen_dp:
            seen_dp.add(key)
            db_session.add(
                DiagramPart(
                    diagram_id  = diagram.id,
                    part_id     = part.id,
                    ref_num     = p["ref_num"],
                    quantity    = p["quantity"],
                    destination = p["destination"],
                    remarks     = p["remarks"],
                )
            )

        if part not in moto.parts:
            moto.parts.append(part)

    db_session.commit()

    logger.info(
        "    ✓ [%s] — %d parts%s",
        card["title"],
        len(data["parts"]),
        "" if data["image_url"] else " (no image)",
    )


# ── Motorcycle-level scraping ─────────────────────────────────────────────────

def scrape_motorcycle(
    *,
    category_id: int,
    category_name: str,
    year: str,
    model_code: str,
    model_name: str,
    db_session,
    session: KawasakiSession,
    cache: WebCacheClient,
    http: httpx.Client,
) -> None:
    """
    Scrape all diagrams for a single motorcycle variant.

    1. Upserts the Motorcycle record.
    2. Fetches the categories page (lists all diagram cards for this vehicle).
    3. Scrapes each diagram page.
    4. Marks the motorcycle as fully scraped.
    """
    categories_url = f"{BASE_URL}/en-us/owner-center/parts/{year}/{model_code}"

    moto = upsert_motorcycle(
        db_session,
        category_id=category_id,
        category_name=category_name,
        year=year,
        model_code=model_code,
        model_name=model_name,
        source_url=categories_url,
    )
    db_session.commit()

    if moto.scraped_at:
        logger.debug("Already fully scraped: %s %s %s", year, model_name, model_code)
        return

    logger.info(
        "  [%s] %s %s (%s)",
        category_name, year, model_name, model_code,
    )

    try:
        html = fetch_page(categories_url, session, cache)
    except Exception as exc:
        logger.error("Skipping motorcycle %s %s: %s", year, model_code, exc)
        return

    cards = parse_diagram_cards(html)
    if not cards:
        logger.warning("No diagram cards found for %s %s", year, model_code)
        # Still mark as scraped so we don't re-attempt every run
        moto.scraped_at = datetime.now(timezone.utc)
        db_session.commit()
        return

    logger.info("    %d diagrams", len(cards))

    for card in cards:
        check_shutdown()
        scrape_diagram(card, moto, db_session, session, cache, http)

    moto.scraped_at = datetime.now(timezone.utc)
    db_session.commit()


# ── Main orchestrator ─────────────────────────────────────────────────────────

def main() -> None:
    PART_DATA_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # File log handler (opened after directories exist)
    fh = logging.FileHandler(PART_DATA_DIR / "scraper.log")
    fh.setFormatter(_fmt)
    logging.root.addHandler(fh)

    init_db()

    # Verify WebCache is reachable before starting
    cache = WebCacheClient(WEBCACHE_URL)
    try:
        cache.health()
    except Exception as exc:
        logger.error("WebCache not reachable at %s: %s", WEBCACHE_URL, exc)
        sys.exit(1)

    logger.info("=== Kawasaki parts scraper starting ===")

    session = KawasakiSession()
    # Warm up session immediately
    session._refresh()

    http = httpx.Client(
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
        timeout=30.0,
    )

    try:
        with SessionFactory() as db_session:
            for cat_id, cat_name in CATEGORIES.items():
                logger.info("━━ Category: %s (id=%d) ━━", cat_name, cat_id)

                # ── Step 1: years for this category ───────────────────────────
                years_cache_key = (
                    f"kawasaki://api/years?cat={cat_id}"
                )
                try:
                    years_data = fetch_json_api(
                        AJAX_YEARS_URL,
                        {"ProductCategoryId": cat_id, "ModelYear": ""},
                        years_cache_key,
                        session,
                        cache,
                    )
                except Exception as exc:
                    logger.error("Could not fetch years for category %d: %s", cat_id, exc)
                    continue

                logger.info("  %d years available", len(years_data))

                for year_entry in years_data:
                    check_shutdown()
                    year: str = year_entry["Id"]

                    # ── Step 2: models for this category + year ───────────────
                    models_cache_key = (
                        f"kawasaki://api/products?cat={cat_id}&year={year}"
                    )
                    try:
                        models_data = fetch_json_api(
                            AJAX_PRODUCTS_URL,
                            {"ProductCategoryId": cat_id, "ModelYear": year},
                            models_cache_key,
                            session,
                            cache,
                        )
                    except Exception as exc:
                        logger.error(
                            "Could not fetch models for cat=%d year=%s: %s",
                            cat_id, year, exc,
                        )
                        continue

                    if not models_data:
                        logger.debug("No models for cat=%d year=%s", cat_id, year)
                        continue

                    logger.info("  Year %s: %d models", year, len(models_data))

                    for model_entry in models_data:
                        check_shutdown()
                        scrape_motorcycle(
                            category_id   = cat_id,
                            category_name = cat_name,
                            year          = year,
                            model_code    = model_entry["Id"],
                            model_name    = model_entry["Value"],
                            db_session    = db_session,
                            session       = session,
                            cache         = cache,
                            http          = http,
                        )

    finally:
        session.close()
        http.close()

    logger.info("=== Scraping complete ===")


if __name__ == "__main__":
    main()
