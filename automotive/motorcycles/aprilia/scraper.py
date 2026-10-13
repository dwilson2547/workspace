#!/usr/bin/env python3
# Site: Aprilia Genuine Parts Catalogue — aprilia.genuine-parts-catalogue.com
# Strategy: static-html (fully server-rendered since the site redesign; no browser)
# Last recon: 2026-10-12
#
# URL hierarchy (all levels list their children as absolute links):
#   /aprilia-motorcycle                                        — displacement groups
#   /aprilia-motorcycle/{cc}-APRILIA-{TYPE}                    — models
#   /aprilia-motorcycle/{cc}-APRILIA-{TYPE}/{MODEL}           — years (4-digit)
#   /aprilia-motorcycle/…/{YEAR}/{TRIM_SLUG}/{TRIM_ID}        — trim catalogue
#     trim page groups diagram cards in category accordions:
#       .accordion-item > header .accordion-button-text        — category (FRAME, ENGINE, …)
#       a.diagram-card__footer-title-link                      — /diagram/{id}-{slug}?machine_id={mid}
#   /diagram/{id}-{slug}?machine_id={mid}                      — diagram page
#     img.diagram-hotspot__image                               — 900x900 diagram image
#     .diagram__list-item                                      — parts rows:
#       .diagram__list-number span                             — callout index
#       .diagram__list-title span                              — part name
#       a.diagram__list-ref                                    — part number (text); class
#         …--line-through marks a superseded reference
#       .diagram__list-price / .diagram__list-unavailable      — price / availability
#
# One callout index can list several part numbers (colour/variant options) and one
# part number can appear at several indices; the latter collapse to one DiagramPart
# row whose extras["ref_nums"] carries every index.
#
# Runs under scrape-job-manager (scrape_contract exit codes + result payload).
# All target-site requests go through request-auth permits; pages through
# webcache; diagram images through imgcache. Progress is resume-safe
# (scraped_at), so weekly runs continue a backfill where the last one stopped.
#
# Rate limiting: the site throttles per IP (~400 requests per ~15 min judging by
# the 2026-10-13 runs) and answers with a reCAPTCHA "Verification Required"
# page instead of an HTTP error. request-auth paces this domain at 1 req/15s
# (set via the request-auth API, not in code). The scraper detects the
# challenge page, never caches it, and aborts the run gracefully — the next
# run resumes from where this one stopped.

import logging
import os
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
    BASE_URL,
    CACHE_BUCKET,
    CACHE_CLIENT_NAME,
    DISPLACEMENT_TYPE_MAP,
    IMGCACHE_URL,
    MAIN_PAGE_URL,
    MAX_RETRIES,
    PAGE_HEADERS,
    REQUEST_AUTH_SERVER_URL,
    RETRY_BACKOFF_SECONDS,
    SITE_DOMAIN,
    WEBCACHE_URL,
)

MAKE = "Aprilia"

# Marker for the site's reCAPTCHA rate-limit gate page.
CHALLENGE_MARKER = "Verification Required"


class ChallengeDetected(Exception):
    """The site served its reCAPTCHA gate page — abort the run gracefully."""


def is_challenge_page(html: str) -> bool:
    return CHALLENGE_MARKER in html[:2000]

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


# ── HTTP client (request-auth paced) ──────────────────────────────────────────

class ApriliaClient:
    """httpx wrapper: every target-site request runs under a request-auth permit."""

    def __init__(self, request_auth: RequestAuthClient) -> None:
        self._request_auth = request_auth
        self._client = httpx.Client(
            headers={"User-Agent": PAGE_HEADERS["User-Agent"]},
            follow_redirects=True,
            timeout=30.0,
        )

    def get(self, url: str) -> httpx.Response:
        with self._request_auth.acquire(SITE_DOMAIN) as permit:
            r = self._client.get(url, headers=PAGE_HEADERS, timeout=30)
            permit.set_status(r.status_code)
        return r

    def get_bytes(self, url: str) -> bytes:
        with self._request_auth.acquire(SITE_DOMAIN) as permit:
            r = self._client.get(url, timeout=30)
            permit.set_status(r.status_code)
            r.raise_for_status()
        return r.content

    def close(self) -> None:
        self._client.close()


# ── Webcache-aware fetchers ───────────────────────────────────────────────────

def fetch_page(url: str, client: ApriliaClient, cache: WebCacheClient) -> str:
    """
    Return the HTML for *url*.

    1. Checks WebCache first.
    2. On a cache miss: fetches under a request-auth permit, stores in cache,
       and returns the HTML.
    3. Retries up to MAX_RETRIES times with back-off on transport errors.
    """
    url = url.strip()

    try:
        cached = cache.get(url, bucket=CACHE_BUCKET)
        if cached:
            if is_challenge_page(cached.get("content", "")):
                # Poisoned entry from a run that tripped the rate-limit gate.
                logger.warning("Cached entry for %s is a challenge page — deleting.", url)
                try:
                    cache.delete(cached["content_hash"], bucket=CACHE_BUCKET)
                except Exception as exc:
                    logger.warning("WebCache delete failed for %s: %s", url, exc)
                raise ChallengeDetected(url)
            logger.debug("[cache hit] %s", url)
            return cached["content"]
    except ChallengeDetected:
        raise
    except Exception as exc:
        logger.warning("WebCache GET failed for %s: %s", url, exc)

    logger.info("[fetch] %s", url)
    check_shutdown()

    last_exc: Optional[Exception] = None
    html = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = client.get(url)
            r.raise_for_status()
            html = r.text
            if is_challenge_page(html):
                raise ChallengeDetected(url)
            break
        except ChallengeDetected:
            raise
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


# ── Image persistence (imgcache) ──────────────────────────────────────────────

def persist_image(
    image_url: str,
    client: ApriliaClient,
    img_cache: ImgCacheClient,
    db_session,
) -> Optional[int]:
    """Persist *image_url* through imgcache and return the Image.id.

    imgcache content-addresses the bytes; the Image row is keyed by the imgcache
    content hash so identical images share a row. Returns None on failure
    (non-fatal).
    """
    if not image_url:
        return None

    if not image_url.startswith("http"):
        image_url = BASE_URL + image_url

    entry = None
    try:
        entry = img_cache.lookup(image_url, bucket=CACHE_BUCKET)
    except Exception as exc:
        logger.warning("ImgCache lookup failed for %s: %s", image_url, exc)

    if entry is None:
        check_shutdown()
        try:
            data = client.get_bytes(image_url)
        except ChallengeDetected:
            raise
        except Exception as exc:
            logger.warning("Image download failed (%s): %s", image_url, exc)
            return None
        if CHALLENGE_MARKER.encode() in data[:2000]:
            logger.warning("Challenge page returned for image %s — aborting.", image_url)
            raise ChallengeDetected(image_url)
        try:
            entry = img_cache.store(
                url=image_url, file_bytes=data,
                client_name=CACHE_CLIENT_NAME, bucket=CACHE_BUCKET,
            )
        except Exception as exc:
            logger.warning("ImgCache store failed for %s: %s", image_url, exc)
            return None

    content_hash = entry.get("content_hash") or entry.get("hash")
    if not content_hash:
        logger.warning("ImgCache entry for %s has no content hash: %s", image_url, entry)
        return None

    existing = db_session.query(Image).filter_by(content_hash=content_hash).first()
    if existing:
        return existing.id

    img = Image(content_hash=content_hash, source_url=image_url)
    db_session.add(img)
    db_session.flush()
    return img.id


# ── HTML parsers ──────────────────────────────────────────────────────────────

def _abs(href: str) -> str:
    href = href.strip()
    return href if href.startswith("http") else BASE_URL + href


def extract_child_links(
    html: str,
    base_path: str,
    depth: int,
    numeric_last: bool = False,
) -> list[str]:
    """
    Return unique absolute URLs whose path:
      • starts with *base_path* (e.g. '/aprilia-motorcycle/50-APRILIA-MOTORCYCLES/RS/')
      • has exactly *depth* path segments ('/a/b/c' → depth 3)
    If *numeric_last* is True, only URLs whose last segment is an integer are
    returned.
    """
    soup = BeautifulSoup(html, "lxml")
    seen: set[str] = set()
    result: list[str] = []

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href == "#" or href.startswith("#"):
            continue
        full = _abs(href)
        if not full.startswith(BASE_URL):
            continue

        path = urlparse(full).path.rstrip("/")
        if not path.startswith(base_path.rstrip("/")):
            continue
        parts = path.split("/")
        if len(parts) - 1 != depth:
            continue
        if numeric_last and not parts[-1].isdigit():
            continue
        if full not in seen:
            seen.add(full)
            result.append(full)

    return result


def parse_displacement_groups(html: str) -> list[dict]:
    """Extract displacement groups from the main motorcycle page.

    Slugs look like /aprilia-motorcycle/{cc}-APRILIA-{TYPE}; utility pages
    (e.g. /aprilia-motorcycle/price) are excluded by the '-APRILIA-' check.
    Returns [{'url', 'displacement', 'vehicle_type'}].
    """
    soup = BeautifulSoup(html, "lxml")
    seen: set[str] = set()
    groups: list[dict] = []

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        path = urlparse(_abs(href)).path
        if not path.startswith("/aprilia-motorcycle/"):
            continue
        parts = path.rstrip("/").split("/")
        if len(parts) != 3:
            continue
        slug = parts[2]
        if "-APRILIA-" not in slug:
            continue

        full = _abs(href)
        if full in seen:
            continue
        seen.add(full)

        vehicle_type = "Unknown"
        for key, label in DISPLACEMENT_TYPE_MAP.items():
            if slug.endswith(key):
                vehicle_type = label
                break
        groups.append({
            "url":          full,
            "displacement": slug.split("-")[0],
            "vehicle_type": vehicle_type,
        })

    return groups


def parse_trim_page(html: str) -> list[dict]:
    """Parse a trim catalogue page into diagram cards.

    Cards live inside per-category accordions:
      .accordion-item > .accordion-header .accordion-button-text  — category
      a.diagram-card__footer-title-link → /diagram/{id}-{slug}?machine_id={mid}

    Returns [{'href', 'diagram_id', 'title', 'category'}].
    """
    soup = BeautifulSoup(html, "lxml")
    cards: list[dict] = []
    seen: set[str] = set()

    for item in soup.select(".accordion-item"):
        header = item.select_one(".accordion-button-text")
        category = header.get_text(strip=True) if header else "Unknown"

        for a in item.select("a.diagram-card__footer-title-link"):
            href = a.get("href", "").strip()
            if not href:
                continue
            full = _abs(href)
            if full in seen:
                continue
            seen.add(full)

            m = re.search(r"/diagram/(\d+)-", urlparse(full).path)
            diagram_id = int(m.group(1)) if m else 0
            cards.append({
                "href":       full,
                "diagram_id": diagram_id,
                "title":      a.get_text(strip=True),
                "category":    category,
            })

    return cards


def parse_diagram_page(html: str) -> dict:
    """Parse a diagram page and return::

        {
          'image_url': str | None,
          'parts': [
            { 'index': str, 'part_number': str, 'name': str,
              'price': str, 'available': bool, 'superseded': bool }
          ]
        }
    """
    soup = BeautifulSoup(html, "lxml")

    img_el = soup.select_one("img.diagram-hotspot__image")
    image_url = img_el.get("src") if img_el else None

    parts: list[dict] = []
    for row in soup.select(".diagram__list-item"):
        num_el = row.select_one(".diagram__list-number span")
        title_el = row.select_one(".diagram__list-title span")
        ref_el = row.select_one("a.diagram__list-ref")
        price_el = row.select_one(".diagram__list-price")
        unavail_el = row.select_one(".diagram__list-unavailable")

        part_number = ref_el.get_text(strip=True) if ref_el else ""
        if not part_number:
            continue  # skip rows without an OEM reference

        superseded = "diagram__list-ref--line-through" in (ref_el.get("class") or [])
        price = ""
        available = unavail_el is None
        if available and price_el:
            price = price_el.get_text(strip=True)

        parts.append({
            "index":       num_el.get_text(strip=True) if num_el else "",
            "part_number": part_number,
            "name":        title_el.get_text(strip=True) if title_el else "",
            "price":       price,
            "available":   available,
            "superseded":  superseded,
        })

    return {"image_url": image_url, "parts": parts}


# ── Database helpers ──────────────────────────────────────────────────────────

def upsert_motorcycle(
    db_session,
    *,
    vehicle_type: str,
    displacement: str,
    model_slug: str,
    year: str,
    trim_slug: str,
    trim_id: str,
    source_url: str,
) -> Motorcycle:
    variant_key = f"{displacement}cc|{model_slug}|{year}|{trim_id}"
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
        model_code=model_slug,
        model_name=model_slug.replace("-", " "),
        trim_name=trim_slug.replace("-", " "),
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
    elif not part.name and name:
        part.name = name
    return part


# ── Diagram-level scraping ────────────────────────────────────────────────────

def scrape_diagram(
    card: dict,
    moto: Motorcycle,
    db_session,
    client: ApriliaClient,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    counters: dict,
) -> None:
    """Scrape a single diagram page identified by *card* (from parse_trim_page).

    • Persists the diagram image through imgcache.
    • Persists all parts and their callout positions.
    • Links the diagram and its parts to the Motorcycle record.
    • No-op if the diagram already has a scraped_at timestamp.
    """
    url = card["href"]

    existing = db_session.query(Diagram).filter_by(source_url=url).first()
    if existing and existing.scraped_at:
        logger.debug("Already scraped diagram: %s", url)
        return

    try:
        html = fetch_page(url, client, cache)
    except ChallengeDetected:
        raise
    except Exception as exc:
        logger.error("Skipping diagram %s: %s", url, exc)
        return

    data = parse_diagram_page(html)

    cat = upsert_part_category(db_session, card["category"] or "Unknown")
    image_id = persist_image(data["image_url"], client, img_cache, db_session)

    if existing:
        existing.image_id = image_id
        existing.scraped_at = datetime.now(timezone.utc)
        diagram = existing
    else:
        diagram = Diagram(
            title=card["title"],
            category_id=cat.id,
            image_id=image_id,
            source_url=url,
            scraped_at=datetime.now(timezone.utc),
        )
        db_session.add(diagram)
        db_session.flush()

    if moto not in diagram.motorcycles:
        diagram.motorcycles.append(moto)

    # One part number can appear at several callout indices; collapse to one
    # DiagramPart row whose extras["ref_nums"] carries every index.
    by_part: dict[str, dict] = {}
    for p in data["parts"]:
        entry = by_part.setdefault(p["part_number"], {
            "index": p["index"],
            "name": p["name"],
            "price": p["price"],
            "available": p["available"],
            "superseded": p["superseded"],
            "ref_nums": [],
        })
        if p["index"] and p["index"] not in entry["ref_nums"]:
            entry["ref_nums"].append(p["index"])

    seen_dp: set[tuple[int, int]] = set()
    for existing_dp in db_session.query(DiagramPart).filter_by(diagram_id=diagram.id).all():
        seen_dp.add((existing_dp.diagram_id, existing_dp.part_id))

    for part_number, entry in by_part.items():
        part = upsert_part(db_session, part_number, entry["name"])
        counters["parts_seen"] += 1

        key = (diagram.id, part.id)
        if key not in seen_dp:
            seen_dp.add(key)
            db_session.add(
                DiagramPart(
                    diagram_id=diagram.id,
                    part_id=part.id,
                    ref_num=entry["index"],
                    quantity=None,   # not exposed on the current site design
                    extras={
                        "price": entry["price"],
                        "available": entry["available"],
                        "superseded": entry["superseded"],
                        "ref_nums": entry["ref_nums"],
                    },
                )
            )
            counters["parts_new"] += 1

        if part not in moto.parts:
            moto.parts.append(part)

    db_session.commit()
    counters["diagrams"] += 1

    logger.info(
        "    ✓ [%s] %s — %d parts%s",
        card["category"], card["title"], len(by_part),
        "" if data["image_url"] else " (no image)",
    )


# ── Trim-level scraping ───────────────────────────────────────────────────────

def scrape_trim(
    *,
    trim_url: str,
    vehicle_type: str,
    displacement: str,
    model_slug: str,
    year: str,
    db_session,
    client: ApriliaClient,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    counters: dict,
) -> None:
    """Scrape all diagram pages for a single trim."""
    url_parts = urlparse(trim_url).path.rstrip("/").split("/")
    trim_slug = url_parts[-2]
    trim_id = url_parts[-1]

    moto = upsert_motorcycle(
        db_session,
        vehicle_type=vehicle_type,
        displacement=displacement,
        model_slug=model_slug,
        year=year,
        trim_slug=trim_slug,
        trim_id=trim_id,
        source_url=trim_url,
    )
    db_session.commit()

    if moto.scraped_at:
        logger.debug("Trim already fully scraped: %s", trim_url)
        return

    try:
        html = fetch_page(trim_url, client, cache)
    except ChallengeDetected:
        raise
    except Exception as exc:
        logger.error("Skipping trim %s: %s", trim_url, exc)
        return

    cards = parse_trim_page(html)
    if not cards:
        logger.warning("No diagram cards found for %s", trim_url)
        # Still mark as scraped so we don't re-attempt every run
        moto.scraped_at = datetime.now(timezone.utc)
        db_session.commit()
        return

    logger.info(
        "  %s %s %s %s | %s | %d diagrams",
        vehicle_type, displacement, model_slug, year, trim_slug.replace("-", " "),
        len(cards),
    )

    for card in cards:
        check_shutdown()
        scrape_diagram(card, moto, db_session, client, cache, img_cache, counters)

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

    logger.info("=== Aprilia parts scraper starting ===")

    client = ApriliaClient(request_auth)

    total_trims = 0
    aborted = False
    try:
        with SessionFactory() as db_session:
            # ── Step 1: displacement groups ───────────────────────────────────
            main_html = fetch_page(MAIN_PAGE_URL, client, cache)
            groups = parse_displacement_groups(main_html)
            logger.info("Found %d displacement groups", len(groups))

            for group in groups:
                check_shutdown()
                displacement = group["displacement"]
                vehicle_type = group["vehicle_type"]

                logger.info("── %s %s cc ──", vehicle_type, displacement)

                # ── Step 2: models ──────────────────────────────────────────
                disp_path = urlparse(group["url"]).path
                try:
                    disp_html = fetch_page(group["url"], client, cache)
                except ChallengeDetected:
                    raise
                except Exception as exc:
                    logger.error("Skipping displacement %s: %s", group["url"], exc)
                    continue

                model_urls = extract_child_links(disp_html, disp_path + "/", depth=3)
                logger.info("  %d models", len(model_urls))

                for model_url in model_urls:
                    check_shutdown()
                    model_slug = urlparse(model_url).path.rstrip("/").split("/")[-1]

                    # ── Step 3: years ────────────────────────────────────────
                    try:
                        model_html = fetch_page(model_url, client, cache)
                    except ChallengeDetected:
                        raise
                    except Exception as exc:
                        logger.error("Skipping model %s: %s", model_url, exc)
                        continue

                    model_path = urlparse(model_url).path
                    year_urls = [
                        u for u in extract_child_links(model_html, model_path + "/", depth=4)
                        if len(u.rstrip("/").split("/")[-1]) == 4
                        and u.rstrip("/").split("/")[-1].isdigit()
                    ]

                    for year_url in year_urls:
                        check_shutdown()
                        year = year_url.rstrip("/").split("/")[-1]

                        # ── Step 4: trims ────────────────────────────────────
                        try:
                            year_html = fetch_page(year_url, client, cache)
                        except ChallengeDetected:
                            raise
                        except Exception as exc:
                            logger.error("Skipping year %s: %s", year_url, exc)
                            continue

                        year_path = urlparse(year_url).path
                        trim_urls = extract_child_links(
                            year_html, year_path + "/", depth=6, numeric_last=True,
                        )
                        total_trims += len(trim_urls)

                        for trim_url in trim_urls:
                            check_shutdown()
                            scrape_trim(
                                trim_url=trim_url,
                                vehicle_type=vehicle_type,
                                displacement=displacement,
                                model_slug=model_slug,
                                year=year,
                                db_session=db_session,
                                client=client,
                                cache=cache,
                                img_cache=img_cache,
                                counters=counters,
                            )
    except ShutdownRequested:
        logger.info("Graceful shutdown: returning partial result.")
    except ChallengeDetected as exc:
        # The reCAPTCHA gate means the site's rate limit was hit; hammering on
        # would only burn retries. Return the partial result — the next run
        # resumes (scraped_at), once the site's window has decayed.
        aborted = True
        logger.error("Rate-limit challenge page received for %s — aborting run.", exc)
    finally:
        client.close()
        request_auth.close()

    if total_trims == 0:
        raise Broken("enumeration found no trims — site or selector drift?")

    logger.info("=== Scraping complete ===" if not aborted
                else "=== Run aborted at the site's rate-limit gate ===")
    return {
        "items": counters["diagrams"],
        "new": counters["parts_new"],
        "motorcycles": counters["motorcycles"],
        "message": "rate-limit challenge page — aborted run, resume next run"
                   if aborted else "ok",
    }


if __name__ == "__main__":
    run(main)
