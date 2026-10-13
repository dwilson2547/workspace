#!/usr/bin/env python3
# Site: Ducati Omaha OEM parts catalogues (republished on Issuu)
# Strategy: static-http + svg-parsing (no browser, no PDFs, no OCR — see
#   svg_parse.py: Issuu renders every page as an SVG with a text layer, for
#   both born-digital catalogues and scans with Issuu's own OCR)
# Discovered endpoints (recon 2026-10-13):
#   GET ducatiomaha.com/pages/ducati-oem-parts      (index; 598 catalog links)
#   GET reader3.isu.pub/{user}/{slug}/reader4.json  (page list; svgUrl per page)
#   GET svg.issuu.com/{revision}-{pub}/page_N.svg    (per-page vector render)
# Last recon: 2026-10-13
#
# Page flow per catalogue (pages are sequential; a drawing's table pages
# follow its drawing page under the same "DRAWING {code}" header):
#   contents pages → skipped
#   drawing pages  → subsystem code+name, rasterized page image → imgcache
#   table pages    → part rows: callout | code | description | qty
# A drawing is marked complete (scraped_at) when the NEXT code appears, so
# multi-page tables accumulate correctly.
#
# Runs under scrape-job-manager (scrape_contract exit codes + result payload).
# All target requests run under request-auth permits; reader4.json and page
# SVGs through webcache (re-runs are nearly free); progress is resume-safe
# (scraped_at per diagram, keyed by catalogue slug).

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
    get_engine,
    get_session_factory,
    init_db,
)
from scrape_contract import Broken, run  # noqa: E402

import svg_parse  # noqa: E402

from config import (  # noqa: E402
    CACHE_BUCKET,
    CACHE_CLIENT_NAME,
    IMGCACHE_URL,
    INDEX_DOMAIN,
    ISSUU_DOC_URL,
    MAX_RETRIES,
    PAGE_HEADERS,
    READER_BASE,
    READER_DOMAIN,
    READER_JSON_MAX_AGE_DAYS,
    REQUEST_AUTH_SERVER_URL,
    RETRY_BACKOFF_SECONDS,
    SOURCE_URL,
    SVG_DOMAIN,
    WEBCACHE_URL,
)

MAKE = "Ducati"

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
# run should have exited. Long-running backfills stop there gracefully.
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


# ── HTTP client (request-auth paced) ──────────────────────────────────────────

class DucatiClient:
    """httpx wrapper: every target request runs under a request-auth permit."""

    def __init__(self, request_auth: RequestAuthClient) -> None:
        self._request_auth = request_auth
        self._client = httpx.Client(
            headers={"User-Agent": PAGE_HEADERS["User-Agent"]},
            follow_redirects=True,
            timeout=30.0,
        )

    def get_text(self, url: str, domain: str) -> str:
        with self._request_auth.acquire(domain) as permit:
            r = self._client.get(url, headers=PAGE_HEADERS, timeout=30)
            permit.set_status(r.status_code)
        r.raise_for_status()
        return r.text

    def close(self) -> None:
        self._client.close()


# ── Webcache-aware fetchers ───────────────────────────────────────────────────

def fetch_text(url: str, domain: str, client: DucatiClient, cache: WebCacheClient,
               max_age: Optional[int] = None) -> Optional[str]:
    """Fetch a text resource via webcache; None on unrecoverable failure."""
    try:
        cached = cache.get(url, bucket=CACHE_BUCKET, max_age=max_age)
        if cached:
            return cached["content"]
    except Exception as exc:
        logger.warning("WebCache GET failed for %s: %s", url, exc)

    logger.info("[fetch] %s", url)
    check_shutdown()

    last_exc: Optional[Exception] = None
    text = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            text = client.get_text(url, domain)
            break
        except Exception as exc:
            last_exc = exc
            logger.warning("Error fetching %s (attempt %d/%d): %s", url, attempt, MAX_RETRIES, exc)
            check_shutdown()
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    else:
        logger.error("Failed to fetch %s after %d attempts — skipping", url, MAX_RETRIES)
        return None

    try:
        cache.store(url=url, content=text, client_name=CACHE_CLIENT_NAME, bucket=CACHE_BUCKET)
    except Exception as exc:
        logger.warning("WebCache store failed for %s: %s", url, exc)

    return text


# ── Catalogue enumeration ──────────────────────────────────────────────────────

_TITLE_RE = re.compile(r"Ducati Omaha (\d{4}) OEM Ducati (.*?) Parts Diagram", re.IGNORECASE)


def parse_catalog_links(html: str) -> list[dict]:
    """Extract catalogue entries from the index page.

    Returns [{slug, url, year, model_name}] — title metadata when present,
    otherwise the link text and slug-derived year.
    """
    soup = BeautifulSoup(html, "lxml")
    seen: set[str] = set()
    catalogs: list[dict] = []

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        m = re.match(rf"(?:https?://issuu\.com)?/?[^/]*?/docs/([^/?#]+)", href)
        if not m or "issuu.com" not in href:
            continue
        slug = m.group(1)
        if slug in seen:
            continue
        seen.add(slug)

        title = a.get("title", "") or ""
        tm = _TITLE_RE.search(title)
        year = tm.group(1) if tm else ""
        model_name = tm.group(2).strip() if tm else a.get_text(strip=True)
        if not year:
            sm = re.match(r"^(20\d{2})_", slug) or re.search(r"_((?:19|20)\d{2})_", slug)
            if sm:
                year = sm.group(1)
            else:
                sm = re.search(r"[_/](\d{2})[_\.]", slug) or re.search(r"-(\d{2})$", slug)
                if sm:
                    year = f"20{sm.group(1)}"

        catalogs.append({
            "slug": slug,
            "url": f"{ISSUU_DOC_URL}/{slug}",
            "year": year,
            "model_name": model_name,
        })
    return catalogs


# ── Database helpers ──────────────────────────────────────────────────────────

def upsert_motorcycle(db_session, catalog: dict) -> Motorcycle:
    moto = (
        db_session.query(Motorcycle)
        .filter_by(make=MAKE, variant_key=catalog["slug"])
        .first()
    )
    if moto:
        return moto
    moto = Motorcycle(
        make=MAKE,
        vehicle_type="Motorcycle",
        year=catalog["year"] or "unknown",
        model_code=catalog["slug"],
        model_name=catalog["model_name"] or catalog["slug"],
        variant_key=catalog["slug"],
        source_url=catalog["url"],
    )
    db_session.add(moto)
    db_session.flush()
    return moto


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
    elif not part.name and name:
        part.name = name
    return part


# ── Image persistence (imgcache) ──────────────────────────────────────────────

def persist_image(page_url: str, image_bytes: bytes, img_cache: ImgCacheClient, db_session) -> Optional[int]:
    try:
        entry = img_cache.store(
            url=page_url, file_bytes=image_bytes,
            client_name=CACHE_CLIENT_NAME, bucket=CACHE_BUCKET,
        )
    except Exception as exc:
        logger.warning("ImgCache store failed for %s: %s", page_url, exc)
        return None
    content_hash = entry.get("content_hash") or entry.get("hash")
    if not content_hash:
        return None
    existing = db_session.query(Image).filter_by(content_hash=content_hash).first()
    if existing:
        return existing.id
    img = Image(content_hash=content_hash, source_url=page_url)
    db_session.add(img)
    db_session.flush()
    return img.id


# ── Catalogue scraping ─────────────────────────────────────────────────────────

def scrape_catalog(
    catalog: dict,
    moto: Motorcycle,
    db_session,
    client: DucatiClient,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    counters: dict,
) -> None:
    """Walk every page of one catalogue SVG by SVG."""
    if moto.scraped_at:
        logger.debug("Catalogue already fully scraped: %s", catalog["slug"])
        return

    slug = catalog["slug"]
    logger.info("── %s %s [%s] ──", catalog["year"], catalog["model_name"], slug)

    reader_json = fetch_text(
        f"{READER_BASE}/{slug}/reader4.json", READER_DOMAIN, client, cache,
        max_age=READER_JSON_MAX_AGE_DAYS * 86400,
    )
    if reader_json is None:
        logger.error("Skipping catalogue %s: no reader4.json", slug)
        return

    try:
        pages = json.loads(reader_json)["document"]["pages"]
    except Exception as exc:
        logger.error("Bad reader4.json for %s: %s", slug, exc)
        return
    logger.info("  %d pages", len(pages))

    # code → diagram id; a code's pages are contiguous, so completion is
    # detected when the next code appears (or the catalogue ends)
    diagrams: dict[str, int] = {}
    prev_code: Optional[str] = None

    def complete(code: Optional[str]) -> None:
        if code and code in diagrams:
            db_session.query(Diagram).filter_by(id=diagrams[code]).update(
                {"scraped_at": datetime.now(timezone.utc)}
            )
            db_session.commit()

    for n, page_info in enumerate(pages, start=1):
        check_shutdown()
        svg_url = page_info.get("svgUrl")
        if not svg_url:
            continue

        svg_text = fetch_text(svg_url, SVG_DOMAIN, client, cache)
        if svg_text is None:
            continue

        page = svg_parse.parse_page(svg_text)
        header = page["header"]
        if header is None or page["is_contents"]:
            continue

        code, name = header
        page_url = f"{catalog['url']}/{n}"

        # a new code means the previous code's pages are done
        if code != prev_code:
            complete(prev_code)
            prev_code = code

        diagram_id = diagrams.get(code)
        if diagram_id is None:
            diagram_id = _ensure_diagram(
                db_session, code, name, page_url, diagrams
            )
            if diagram_id is None:
                continue
            diagrams[code] = diagram_id

        diagram = db_session.query(Diagram).filter_by(id=diagram_id).first()
        if diagram.scraped_at:
            continue  # already complete from a previous run

        if moto not in diagram.motorcycles:
            diagram.motorcycles.append(moto)

        # drawing pages carry the raster image; keep the first one
        if page["image"] and not diagram.image_id:
            image_id = persist_image(page_url, page["image"], img_cache, db_session)
            if image_id:
                diagram.image_id = image_id
                db_session.commit()

        for row in page["rows"]:
            part = upsert_part(db_session, row["code"], row["description"])
            counters["parts_seen"] += 1

            existing_dp = (
                db_session.query(DiagramPart)
                .filter_by(diagram_id=diagram_id, part_id=part.id)
                .first()
            )
            if existing_dp is None:
                db_session.add(
                    DiagramPart(
                        diagram_id=diagram_id,
                        part_id=part.id,
                        ref_num=row["ref"],
                        quantity=row["qty"],
                        extras={
                            "notes": row["notes"],
                            "validity": row["validity"],
                        },
                    )
                )
                counters["parts_new"] += 1

            if part not in moto.parts:
                moto.parts.append(part)

        if page["rows"]:
            db_session.commit()
            counters["diagrams"] += 1
            logger.info("  ✓ %s %s — %d parts", code, name, len(page["rows"]))

    complete(prev_code)
    moto.scraped_at = datetime.now(timezone.utc)
    db_session.commit()
    counters["motorcycles"] += 1


def _ensure_diagram(db_session, code: str, name: str, page_url: str, diagrams: dict) -> Optional[int]:
    existing = db_session.query(Diagram).filter_by(source_url=page_url).first()
    if existing is None:
        diagram = Diagram(
            title=name or code,
            category_id=None,
            source_url=page_url,
        )
        db_session.add(diagram)
        db_session.flush()
        diagrams[code] = diagram.id
        return diagram.id
    diagrams[code] = existing.id
    return existing.id


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

    logger.info("=== Ducati parts scraper starting ===")

    client = DucatiClient(request_auth)

    total_catalogs = 0
    try:
        with SessionFactory() as db_session:
            index_html = fetch_text(SOURCE_URL, INDEX_DOMAIN, client, cache,
                                     max_age=7 * 86400)
            if index_html is None:
                raise Broken("could not fetch the catalogue index page")
            catalogs = parse_catalog_links(index_html)
            total_catalogs = len(catalogs)
            logger.info("Found %d catalogues", total_catalogs)

            for catalog in catalogs:
                check_shutdown()
                moto = upsert_motorcycle(db_session, catalog)
                db_session.commit()
                scrape_catalog(
                    catalog, moto, db_session,
                    client, cache, img_cache, counters,
                )
    except ShutdownRequested:
        logger.info("Graceful shutdown: returning partial result.")
    finally:
        client.close()
        request_auth.close()

    if total_catalogs == 0:
        raise Broken("index page listed no catalogues — site drift?")

    logger.info("=== Scraping complete ===")
    return {
        "items": counters["diagrams"],
        "new": counters["parts_new"],
        "motorcycles": counters["motorcycles"],
        "message": "ok",
    }


if __name__ == "__main__":
    run(main)
