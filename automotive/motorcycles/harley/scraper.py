#!/usr/bin/env python3
# Site: Harley-Davidson OEM service parts — ARI PartStream JSONP API
# Strategy: ajax-api (plain JSONP calls; no browser, no site session)
# Discovered endpoint / base URL: https://partstream.arinet.com/Parts/{GetAssembly,GetDetails}
# Last recon: 2026-10-13
#
# API shape (note the /Parts/ path prefix — the pre-2026 widget called the bare
# host, which now returns an empty 200):
#   GET /Parts/GetAssembly?arik=..&aril=en-US&ariv=<page url>&responsive=true
#                      &cb=ariCallback&arib=HDM[&aria=<folder id>]
#       → ariCallback({"html":"", "model":{"json":[{data, attr:{aria, rel, slug, src}, state}]}})
#         root children = years; year → category folders → model/trim folders →
#         assemblies (rel=assembly, attr.slug identifies them)
#   GET /Parts/GetDetails?ariq=<slug>&… → ariCallback({"html": "<div id=ariAssembly>…"})
#       the html fragment holds li.ariPartInfo rows (attr tag / partid,
#       .ariPartNumber, .ariPLDesc, .ariPLPrice[price], input qty value) and
#       img#ariparts_image (cdn.datamanager.arinet.com; /Max variant = fullscreen)
#
# Runs under scrape-job-manager (scrape_contract exit codes + result payload).
# API responses go through webcache (keyed by full URL); every target request
# runs under a request-auth permit; diagram images through imgcache. Progress is
# resume-safe (scraped_at), so weekly runs continue a backfill where it stopped.

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
from urllib.parse import urlencode

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
    ARI_API_KEY,
    ARI_BASE_URL,
    ARI_BRAND,
    ARI_IMAGE_DOMAIN,
    ARI_PAGE_URL,
    CACHE_BUCKET,
    CACHE_CLIENT_NAME,
    IMGCACHE_URL,
    MAX_RETRIES,
    PAGE_HEADERS,
    REQUEST_AUTH_SERVER_URL,
    RETRY_BACKOFF_SECONDS,
    SITE_DOMAIN,
    WEBCACHE_URL,
)

MAKE = "Harley-Davidson"

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

class AriClient:
    """httpx wrapper: every PartStream request runs under a request-auth permit."""

    def __init__(self, request_auth: RequestAuthClient) -> None:
        self._request_auth = request_auth
        self._client = httpx.Client(
            headers={"User-Agent": PAGE_HEADERS["User-Agent"]},
            follow_redirects=True,
            timeout=30.0,
        )

    def get_text(self, url: str) -> str:
        with self._request_auth.acquire(SITE_DOMAIN) as permit:
            r = self._client.get(url, headers=PAGE_HEADERS, timeout=30)
            permit.set_status(r.status_code)
        r.raise_for_status()
        return r.text

    def get_bytes(self, url: str, domain: str) -> bytes:
        with self._request_auth.acquire(domain) as permit:
            r = self._client.get(url, timeout=30)
            permit.set_status(r.status_code)
        r.raise_for_status()
        return r.content

    def close(self) -> None:
        self._client.close()


# ── Webcache-aware JSONP fetcher ───────────────────────────────────────────────

def _strip_jsonp(text: str) -> dict:
    start = text.index("(") + 1
    end = text.rindex(")")
    return json.loads(text[start:end])


def _api_params(**kwargs) -> dict:
    params = {
        "arik": ARI_API_KEY,
        "aril": "en-US",
        "ariv": ARI_PAGE_URL,
        "responsive": "true",
        "cb": "ariCallback",
        "arib": ARI_BRAND,
    }
    params.update(kwargs)
    return params


def call_api(client: AriClient, cache: WebCacheClient, endpoint: str, params: dict) -> dict:
    """Fetch a JSONP endpoint, using webcache for deduplication."""
    full_url = f"{ARI_BASE_URL}/{endpoint}?" + urlencode(params)

    try:
        cached = cache.get(full_url, bucket=CACHE_BUCKET)
        if cached:
            return _strip_jsonp(cached["content"])
    except Exception as exc:
        logger.warning("WebCache GET failed for %s: %s", endpoint, exc)

    check_shutdown()
    last_exc: Optional[Exception] = None
    text = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            text = client.get_text(full_url)
            break
        except Exception as exc:
            last_exc = exc
            logger.warning("API error %s (attempt %d/%d): %s", endpoint, attempt, MAX_RETRIES, exc)
            check_shutdown()
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    else:
        raise RuntimeError(
            f"Failed to call {endpoint} after {MAX_RETRIES} attempts"
        ) from last_exc

    try:
        cache.store(url=full_url, content=text, client_name=CACHE_CLIENT_NAME, bucket=CACHE_BUCKET)
    except Exception as exc:
        logger.warning("WebCache store failed for %s: %s", endpoint, exc)

    return _strip_jsonp(text)


def get_children(client: AriClient, cache: WebCacheClient, aria: Optional[str] = None) -> list[dict]:
    """List children of a PartStream folder (root years when aria is None)."""
    params = _api_params()
    if aria:
        params["aria"] = aria
    data = call_api(client, cache, "Parts/GetAssembly", params)
    items = data.get("model", {}).get("json", [])
    if not items and isinstance(data, list):
        items = data  # legacy response shape
    return items


def get_details(client: AriClient, cache: WebCacheClient, slug: str) -> dict:
    params = _api_params(ariq=slug)
    return call_api(client, cache, "Parts/GetDetails", params)


# ── HTML fragment parsing ─────────────────────────────────────────────────────

def parse_details_html(html: str) -> dict:
    """Parse the GetDetails html fragment.

    Returns {'image_url': str|None, 'parts': [{ref, part_number, name, price, quantity}]}.
    """
    soup = BeautifulSoup(html, "lxml")

    image_url = None
    img_tag = soup.find("img", id="ari_fullScreenImg") or soup.find("img", id="ariparts_image")
    if img_tag and img_tag.get("src"):
        image_url = img_tag["src"].split("?")[0]

    parts: list[dict] = []
    for row in soup.select(".ariPartInfo"):
        num_el = row.select_one(".ariPartNumber")
        part_number = (num_el.get("name") or num_el.get_text(strip=True)) if num_el else ""
        if not part_number:
            continue

        desc_el = row.select_one(".ariPLDesc")
        price_el = row.select_one(".ariPLPrice")
        qty_el = row.select_one("input[type=number]")

        price = (price_el.get("price") or price_el.get("adjustedprice") or "") if price_el else ""
        try:
            quantity = int(qty_el.get("value", "1")) if qty_el else None
        except ValueError:
            quantity = None

        parts.append({
            "ref":         row.get("tag", "") or "",
            "part_number": part_number,
            "name":        desc_el.get_text(strip=True) if desc_el else "",
            "price":       price,
            "quantity":     quantity,
        })

    return {"image_url": image_url, "parts": parts}


# ── Name parsing ──────────────────────────────────────────────────────────────

_MODEL_RE = re.compile(
    r"^(?P<model_code>[A-Z0-9]+)\s+(?P<trim_code>[A-Z0-9]+)\s+(?P<model_name>.+?)\s+\((?P<year>\d{4})\)$"
)


def parse_model_label(label: str) -> dict:
    """Parse a label like 'FLFBS 1YGK FAT BOY 114 (2024)' into components."""
    m = _MODEL_RE.match(label.strip())
    if m:
        return m.groupdict()
    year_m = re.search(r"\((\d{4})\)", label)
    return {
        "year": year_m.group(1) if year_m else "unknown",
        "model_code": "",
        "trim_code": "",
        "model_name": label,
    }


# ── Image persistence (imgcache) ──────────────────────────────────────────────

def persist_image(image_url, client: AriClient, img_cache: ImgCacheClient, db_session) -> Optional[int]:
    """Persist *image_url* through imgcache and return the Image.id (None on failure)."""
    if not image_url:
        return None

    entry = None
    try:
        entry = img_cache.lookup(image_url, bucket=CACHE_BUCKET)
    except Exception as exc:
        logger.warning("ImgCache lookup failed for %s: %s", image_url, exc)

    if entry is None:
        check_shutdown()
        try:
            data = client.get_bytes(image_url, ARI_IMAGE_DOMAIN)
        except Exception as exc:
            logger.warning("Image download failed (%s): %s", image_url, exc)
            return None
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
        return None

    existing = db_session.query(Image).filter_by(content_hash=content_hash).first()
    if existing:
        return existing.id

    img = Image(content_hash=content_hash, source_url=image_url)
    db_session.add(img)
    db_session.flush()
    return img.id


# ── Database helpers ──────────────────────────────────────────────────────────

def upsert_motorcycle(
    db_session,
    *,
    vehicle_type: str,
    year: str,
    model_code: str,
    trim_code: str,
    model_name: str,
    aria_code: str,
    source_url: str,
) -> Motorcycle:
    # The PartStream aria node id is unique per model/trim node.
    variant_key = aria_code
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
        trim_name=trim_code,
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
    elif not part.name and name:
        part.name = name
    return part


# ── Scraping logic ────────────────────────────────────────────────────────────

def scrape_assembly(
    item: dict,
    moto: Motorcycle,
    category: PartCategory,
    db_session,
    client: AriClient,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    counters: dict,
) -> None:
    """Scrape one leaf assembly: fetch details, persist image, save parts."""
    attr = item.get("attr", {})
    aria = attr.get("aria", "")
    slug = attr.get("slug", "")
    name = item.get("data", "Unknown Assembly")

    # source_url: the details call for this assembly (unique per assembly)
    source_url = f"{ARI_BASE_URL}/Parts/GetDetails?" + urlencode(_api_params(ariq=slug))

    existing = db_session.query(Diagram).filter_by(source_url=source_url).first()
    if existing and existing.scraped_at:
        logger.debug("Already scraped assembly: %s", name)
        return

    data = get_details(client, cache, slug)
    details = parse_details_html(data.get("html", ""))

    image_id = persist_image(details["image_url"], client, img_cache, db_session)

    if existing:
        existing.image_id = image_id
        existing.scraped_at = datetime.now(timezone.utc)
        diagram = existing
    else:
        diagram = Diagram(
            title=name,
            category_id=category.id,
            image_id=image_id,
            source_url=source_url,
            scraped_at=datetime.now(timezone.utc),
        )
        db_session.add(diagram)
        db_session.flush()

    if moto not in diagram.motorcycles:
        diagram.motorcycles.append(moto)

    seen_dp: set[tuple[int, int]] = set()
    for existing_dp in db_session.query(DiagramPart).filter_by(diagram_id=diagram.id).all():
        seen_dp.add((existing_dp.diagram_id, existing_dp.part_id))

    for p in details["parts"]:
        part = upsert_part(db_session, p["part_number"], p["name"])
        counters["parts_seen"] += 1

        key = (diagram.id, part.id)
        if key not in seen_dp:
            seen_dp.add(key)
            db_session.add(
                DiagramPart(
                    diagram_id=diagram.id,
                    part_id=part.id,
                    ref_num=p["ref"],
                    quantity=p["quantity"],
                    extras={"price": p["price"]},
                )
            )
            counters["parts_new"] += 1

        if part not in moto.parts:
            moto.parts.append(part)

    db_session.commit()
    counters["diagrams"] += 1
    logger.info("    ✓ %s — %d parts", name, len(details["parts"]))


def scrape_model_node(
    *,
    item: dict,
    vehicle_type: str,
    year: str,
    db_session,
    client: AriClient,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    counters: dict,
) -> None:
    """Scrape all assemblies under a model/trim node (recursing through folders)."""
    attr = item.get("attr", {})
    aria = attr.get("aria", "")
    label = item.get("data", "")

    parsed = parse_model_label(label)
    moto = upsert_motorcycle(
        db_session,
        vehicle_type=vehicle_type,
        year=parsed.get("year") or year,
        model_code=parsed.get("model_code") or aria,
        trim_code=parsed.get("trim_code") or "",
        model_name=parsed.get("model_name") or label,
        aria_code=aria,
        source_url=ARI_PAGE_URL,
    )
    db_session.commit()

    if moto.scraped_at:
        logger.debug("Already fully scraped: %s", label)
        return

    logger.info("  %s [%s]", label, vehicle_type)
    category = upsert_part_category(db_session, vehicle_type or "Unknown")

    def walk(node_aria: str, depth: int) -> None:
        if depth > 4:
            logger.warning("Folder nesting deeper than 4 under %s — skipping", aria)
            return
        for child in get_children(client, cache, aria=node_aria):
            check_shutdown()
            c_attr = child.get("attr", {})
            if c_attr.get("rel") == "assembly":
                scrape_assembly(child, moto, category, db_session, client, cache, img_cache, counters)
            elif c_attr.get("rel") == "folder":
                walk(c_attr.get("aria", ""), depth + 1)

    walk(aria, 0)

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

    logger.info("=== Harley-Davidson parts scraper starting ===")

    client = AriClient(request_auth)

    total_models = 0
    try:
        with SessionFactory() as db_session:
            # ── Step 1: years ─────────────────────────────────────────────
            years = get_children(client, cache)
            logger.info("Found %d years", len(years))

            for year_item in years:
                check_shutdown()
                year_aria = year_item.get("attr", {}).get("aria", "")
                year_label = year_item.get("data", "").strip()
                logger.info("── %s ──", year_label)

                # ── Step 2: model categories ───────────────────────────────
                try:
                    categories = get_children(client, cache, aria=year_aria)
                except Exception as exc:
                    logger.error("Skipping year %s: %s", year_label, exc)
                    continue

                for cat_item in categories:
                    check_shutdown()
                    cat_attr = cat_item.get("attr", {})
                    cat_aria = cat_attr.get("aria", "")
                    cat_name = cat_item.get("data", "")

                    if cat_attr.get("rel") == "assembly":
                        # Leaf at category level — treat as a model node
                        total_models += 1
                        scrape_model_node(
                            item=cat_item, vehicle_type=cat_name, year=year_label,
                            db_session=db_session, client=client, cache=cache,
                            img_cache=img_cache, counters=counters,
                        )
                        continue

                    # ── Step 3: models/trims under the category ────────────
                    try:
                        models = get_children(client, cache, aria=cat_aria)
                    except Exception as exc:
                        logger.error("Skipping category %s: %s", cat_name, exc)
                        continue

                    for model_item in models:
                        check_shutdown()
                        total_models += 1
                        scrape_model_node(
                            item=model_item, vehicle_type=cat_name, year=year_label,
                            db_session=db_session, client=client, cache=cache,
                            img_cache=img_cache, counters=counters,
                        )
    except ShutdownRequested:
        logger.info("Graceful shutdown: returning partial result.")
    finally:
        client.close()
        request_auth.close()

    if total_models == 0:
        raise Broken("enumeration found no models — site or API drift?")

    logger.info("=== Scraping complete ===")
    return {
        "items": counters["diagrams"],
        "new": counters["parts_new"],
        "motorcycles": counters["motorcycles"],
        "message": "ok",
    }


if __name__ == "__main__":
    run(main)
