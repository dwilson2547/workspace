#!/usr/bin/env python3
# Site: Kawasaki Owner Center parts diagrams
# Strategy: static-html + ajax-api  (server-rendered; no headless browser needed)
# Discovered endpoint / base URL: https://www.kawasaki.com/en-us/owner-center/parts
# Last recon: 2026-05-05 (see git history for prior recon notes)
#
# URL hierarchy
# -------------
# /en-us/ownercenter/PartsAjaxModelYears   (POST)  → years per category
# /en-us/ownercenter/PartsAjaxProducts     (POST)  → model codes per category + year
# /en-us/owner-center/parts/{year}/{model_code}                 — diagram list
# /en-us/owner-center/parts/{diagram_id}/{year}/{model_code}    — diagram + parts
#
# Runs under scrape-job-manager (scrape_contract exit codes + result payload).
# All target-site requests go through request-auth permits; pages through
# webcache; diagram images through imgcache. Progress is resume-safe
# (scraped_at), so weekly runs continue a backfill where the last one stopped.

import json
import logging
import os
import re
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from cache_client import ImgCacheClient, WebCacheClient
from request_auth_client import RequestAuthClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from motorcycle_common import (  # noqa: E402
    Diagram,
    DiagramPart,
    Image,
    Motorcycle,
    Part,
    PartCategory,
    get_engine,
    get_session_factory,
    init_db,
)
from scrape_contract import Broken, run  # noqa: E402

from config import (  # noqa: E402
    AJAX_HEADERS,
    AJAX_PRODUCTS_URL,
    AJAX_YEARS_URL,
    BASE_URL,
    CACHE_BUCKET,
    CACHE_CLIENT_NAME,
    CATEGORIES,
    IMGCACHE_URL,
    MAIN_PAGE_URL,
    MAX_RETRIES,
    PAGE_HEADERS,
    REQUEST_AUTH_SERVER_URL,
    RETRY_BACKOFF_SECONDS,
    SESSION_REFRESH_INTERVAL,
    SITE_DOMAIN,
    USER_AGENT,
    WEBCACHE_URL,
)

MAKE = "Kawasaki"

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
)
logger = logging.getLogger(__name__)


# ── Graceful shutdown ─────────────────────────────────────────────────────────

class ShutdownRequested(Exception):
    """A SIGTERM/SIGINT arrived; stop after the current item and return the result."""


_shutdown = False

# scrape-job-manager injects SCRAPE_DEADLINE (RFC 3339) — the time by which the
# run should have exited (timeout bound / end of active hours). Long-running
# backfills stop there gracefully: finish current item, write result, exit 0.
_DEADLINE: Optional[datetime] = None


def _parse_deadline() -> Optional[datetime]:
    raw = os.environ.get("SCRAPE_DEADLINE")
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("Unparseable SCRAPE_DEADLINE %r — ignoring", raw)
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _handle_signal(signum: int, _frame) -> None:
    global _shutdown
    logger.warning("Signal %d received — will exit after current item.", signum)
    _shutdown = True


def check_shutdown() -> None:
    global _DEADLINE
    if _shutdown:
        raise ShutdownRequested()
    if _DEADLINE is None:
        _DEADLINE = _parse_deadline()
    if _DEADLINE is not None and datetime.now(timezone.utc) >= _DEADLINE:
        logger.info("SCRAPE_DEADLINE reached — stopping after current item.")
        raise ShutdownRequested()


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)


# ── Session management ────────────────────────────────────────────────────────

class KawasakiSession:
    """
    Manages a persistent httpx.Client with an active ASPSESID session cookie.

    The session is automatically refreshed if it has been idle longer than
    SESSION_REFRESH_INTERVAL seconds or when a request returns unexpected HTML
    instead of JSON (sign that the session has expired).
    """

    def __init__(self, request_auth: RequestAuthClient) -> None:
        self._request_auth = request_auth
        self._client: Optional[httpx.Client] = None
        self._last_refresh: float = 0.0

    def _build_client(self) -> httpx.Client:
        return httpx.Client(
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
            timeout=30.0,
        )

    def _refresh(self) -> None:
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
        self._client = self._build_client()
        logger.info("Establishing session (visiting main page)…")
        try:
            with self._request_auth.acquire(SITE_DOMAIN) as permit:
                r = self._client.get(MAIN_PAGE_URL, headers=PAGE_HEADERS, timeout=20)
                permit.set_status(r.status_code)
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
        with self._request_auth.acquire(SITE_DOMAIN) as permit:
            r = self._client.get(url, headers=PAGE_HEADERS, timeout=30)
            permit.set_status(r.status_code)
        return r

    def post_ajax(self, url: str, data: dict) -> httpx.Response:
        """POST to an AJAX endpoint; refreshes session and retries once on failure."""
        self._ensure_fresh()
        with self._request_auth.acquire(SITE_DOMAIN) as permit:
            r = self._client.post(url, data=data, headers=AJAX_HEADERS, timeout=15)
            permit.set_status(r.status_code)
        # Detect session expiry: server returns full HTML page instead of JSON
        if "application/json" not in r.headers.get("content-type", ""):
            logger.warning("Session appears expired — refreshing and retrying…")
            self._refresh()
            with self._request_auth.acquire(SITE_DOMAIN) as permit:
                r = self._client.post(url, data=data, headers=AJAX_HEADERS, timeout=15)
                permit.set_status(r.status_code)
        return r

    def get_bytes(self, url: str) -> bytes:
        self._ensure_fresh()
        with self._request_auth.acquire(SITE_DOMAIN) as permit:
            r = self._client.get(url, timeout=30)
            permit.set_status(r.status_code)
            r.raise_for_status()
        return r.content

    def close(self) -> None:
        if self._client:
            self._client.close()


# ── Webcache-aware fetchers ───────────────────────────────────────────────────

def fetch_page(url: str, session: KawasakiSession, cache: WebCacheClient) -> str:
    """
    Return the rendered HTML for *url*.

    1. Checks WebCache first.
    2. On a cache miss: fetches under a request-auth permit, stores in cache,
       and returns the HTML.
    3. Retries up to MAX_RETRIES times with back-off on transport errors.
    """
    url = url.strip()

    try:
        cached = cache.get(url, bucket=CACHE_BUCKET)
        if cached:
            logger.debug("[cache hit] %s", url)
            return cached["content"]
    except Exception as exc:
        logger.warning("WebCache GET failed for %s: %s", url, exc)

    logger.info("[fetch] %s", url)
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
            check_shutdown()
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
    """Call a JSON AJAX endpoint (POST) and return the parsed list.

    Caches the JSON response body under *cache_key* so re-runs are instant.
    """
    try:
        cached = cache.get(cache_key, bucket=CACHE_BUCKET)
        if cached:
            logger.debug("[cache hit] %s", cache_key)
            return json.loads(cached["content"])
    except Exception as exc:
        logger.warning("WebCache GET failed for %s: %s", cache_key, exc)

    logger.debug("[api] %s", cache_key)
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
            check_shutdown()
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


# ── Image download & deduplication ────────────────────────────────────────────

def persist_image(
    image_url: str,
    session: KawasakiSession,
    img_cache: ImgCacheClient,
    db_session,
) -> Optional[int]:
    """Persist *image_url* through imgcache and return the Image.id.

    imgcache content-addresses the bytes (perceptual + content hash); the Image
    row is keyed by the imgcache content hash so identical images share a row.
    Returns None on download failure (non-fatal).
    """
    if not image_url:
        return None

    clean_url = image_url.split("?")[0]          # strip ?w=350 thumbnail sizing
    if not clean_url.startswith("http"):
        clean_url = BASE_URL + clean_url

    # Already in imgcache under this URL?
    entry = None
    try:
        entry = img_cache.lookup(clean_url, bucket=CACHE_BUCKET)
    except Exception as exc:
        logger.warning("ImgCache lookup failed for %s: %s", clean_url, exc)

    if entry is None:
        check_shutdown()
        try:
            data = session.get_bytes(clean_url)
        except Exception as exc:
            logger.warning("Image download failed (%s): %s", clean_url, exc)
            return None
        try:
            entry = img_cache.store(
                url=clean_url, file_bytes=data,
                client_name=CACHE_CLIENT_NAME, bucket=CACHE_BUCKET,
            )
        except Exception as exc:
            logger.warning("ImgCache store failed for %s: %s", clean_url, exc)
            return None

    content_hash = entry.get("content_hash") or entry.get("hash")
    if not content_hash:
        logger.warning("ImgCache entry for %s has no content hash: %s", clean_url, entry)
        return None

    existing = db_session.query(Image).filter_by(content_hash=content_hash).first()
    if existing:
        return existing.id

    img = Image(content_hash=content_hash, source_url=clean_url)
    db_session.add(img)
    db_session.flush()
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
    """Parse a single parts-diagram page and return::

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

        name         = texts[0]
        ref_num      = texts[1] if len(texts) > 1 else ""
        part_number  = texts[2] if len(texts) > 2 else ""
        quantity_raw = texts[3] if len(texts) > 3 else "1"
        destination  = texts[4] if len(texts) > 4 else ""
        remarks      = texts[5] if len(texts) > 5 else ""

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
    vehicle_type: str,
    year: str,
    model_code: str,
    model_name: str,
    source_url: str,
) -> Motorcycle:
    variant_key = f"{year}|{model_code}"
    moto = (
        db_session.query(Motorcycle)
        .filter_by(make=MAKE, variant_key=variant_key)
        .first()
    )
    if moto:
        return moto
    moto = Motorcycle(
        make=MAKE,
        vehicle_type=vehicle_type,
        year=year,
        model_code=model_code,
        model_name=model_name,
        variant_key=variant_key,
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
    part = (
        db_session.query(Part)
        .filter_by(make=MAKE, part_number=part_number)
        .first()
    )
    if not part:
        part = Part(make=MAKE, part_number=part_number, name=name)
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
    img_cache: ImgCacheClient,
    counters: dict,
) -> None:
    """
    Scrape a single diagram page identified by *card* (from parse_diagram_cards).

    • Persists the diagram image through imgcache.
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

    cat = upsert_part_category(db_session, card["title"] or "Unknown")
    image_id = persist_image(data["image_url"], session, img_cache, db_session)

    if existing:
        existing.image_id  = image_id
        existing.scraped_at = datetime.now(timezone.utc)
        diagram = existing
    else:
        diagram = Diagram(
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
        counters["parts_seen"] += 1

        key = (diagram.id, part.id)
        if key not in seen_dp:
            seen_dp.add(key)
            db_session.add(
                DiagramPart(
                    diagram_id = diagram.id,
                    part_id    = part.id,
                    ref_num    = p["ref_num"],
                    quantity   = p["quantity"],
                    extras     = {"destination": p["destination"], "remarks": p["remarks"]},
                )
            )
            counters["parts_new"] += 1

        if part not in moto.parts:
            moto.parts.append(part)

    db_session.commit()
    counters["diagrams"] += 1

    logger.info(
        "    ✓ [%s] — %d parts%s",
        card["title"], len(data["parts"]),
        "" if data["image_url"] else " (no image)",
    )


# ── Motorcycle-level scraping ─────────────────────────────────────────────────

def scrape_motorcycle(
    *,
    vehicle_type: str,
    year: str,
    model_code: str,
    model_name: str,
    db_session,
    session: KawasakiSession,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    counters: dict,
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
        vehicle_type=vehicle_type,
        year=year,
        model_code=model_code,
        model_name=model_name,
        source_url=categories_url,
    )
    db_session.commit()

    if moto.scraped_at:
        logger.debug("Already fully scraped: %s %s %s", year, model_name, model_code)
        return

    logger.info("  [%s] %s %s (%s)", vehicle_type, year, model_name, model_code)

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
        scrape_diagram(card, moto, db_session, session, cache, img_cache, counters)

    moto.scraped_at = datetime.now(timezone.utc)
    db_session.commit()
    counters["motorcycles"] += 1


# ── Main orchestrator ─────────────────────────────────────────────────────────

def main() -> dict:
    counters = {"motorcycles": 0, "diagrams": 0, "parts_seen": 0, "parts_new": 0}

    engine = get_engine()
    init_db(engine)
    SessionFactory = get_session_factory(engine)

    cache = WebCacheClient(WEBCACHE_URL)
    img_cache = ImgCacheClient(IMGCACHE_URL)
    request_auth = RequestAuthClient(REQUEST_AUTH_SERVER_URL)

    try:
        cache.health()
        img_cache.health()
    except Exception as exc:
        raise Broken(f"scrape-stack cache service unreachable: {exc}") from exc

    logger.info("=== Kawasaki parts scraper starting ===")

    session = KawasakiSession(request_auth)
    # Warm up session immediately
    session._refresh()

    total_models = 0
    try:
        with SessionFactory() as db_session:
            for cat_id, cat_name in CATEGORIES.items():
                logger.info("━━ Category: %s (id=%d) ━━", cat_name, cat_id)

                # ── Step 1: years for this category ───────────────────────────
                years_cache_key = f"kawasaki://api/years?cat={cat_id}"
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
                    models_cache_key = f"kawasaki://api/products?cat={cat_id}&year={year}"
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
                    total_models += len(models_data)

                    for model_entry in models_data:
                        check_shutdown()
                        scrape_motorcycle(
                            vehicle_type = cat_name,
                            year         = year,
                            model_code   = model_entry["Id"],
                            model_name   = model_entry["Value"],
                            db_session   = db_session,
                            session      = session,
                            cache        = cache,
                            img_cache    = img_cache,
                            counters     = counters,
                        )
    except ShutdownRequested:
        logger.info("Graceful shutdown: returning partial result.")
    finally:
        session.close()
        request_auth.close()

    if total_models == 0:
        raise Broken("enumeration returned no models — site or API drift?")

    logger.info("=== Scraping complete ===")
    return {
        "items": counters["diagrams"],
        "new": counters["parts_new"],
        "motorcycles": counters["motorcycles"],
        "message": "ok",
    }


if __name__ == "__main__":
    run(main)
