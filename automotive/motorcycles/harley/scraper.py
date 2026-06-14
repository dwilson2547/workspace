"""
Harley-Davidson OEM Service Parts Scraper
==========================================
Uses the ARI PartStream JSONP API to traverse the full parts catalog:
    Year → Model Category → Model/Trim → Assembly → Parts

All HTTP responses are cached via webcache (http://localhost:8000).
All diagram images are cached via imgcache (http://localhost:8010).
"""

import json
import logging
import random
import re
import signal
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode, urlparse

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

import config
from config import (
    ARI_API_KEY,
    ARI_BASE_URL,
    ARI_BRAND,
    ARI_PAGE_URL,
    BACKOFF_FILE,
    CACHE_CLIENT_NAME,
    DELAY_MAX,
    DELAY_MIN,
    DOMAIN,
    IMGCACHE_URL,
    USER_AGENT,
    WEBCACHE_URL,
)
from db import Diagram, DiagramPart, Motorcycle, Part, SessionFactory, init_db, motorcycle_parts

# Bootstrap webcache / imgcache clients (path insertion done in config.py)
from webcache_client import WebCacheClient  # noqa: E402
from imgcache_client import ImgCacheClient  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------
_shutdown = False


def _sigterm_handler(sig, frame):
    global _shutdown
    log.warning("Shutdown signal received — will stop after current record.")
    _shutdown = True


signal.signal(signal.SIGTERM, _sigterm_handler)
signal.signal(signal.SIGINT, _sigterm_handler)


# ---------------------------------------------------------------------------
# Backoff helpers
# ---------------------------------------------------------------------------

def _load_backoff() -> dict:
    if BACKOFF_FILE.exists():
        try:
            return json.loads(BACKOFF_FILE.read_text())
        except Exception:
            pass
    return {}


def _save_backoff(data: dict) -> None:
    BACKOFF_FILE.write_text(json.dumps(data))


def check_backoff(domain: str) -> None:
    """Raise RuntimeError if domain is currently backed off."""
    data = _load_backoff()
    if domain in data:
        until = datetime.fromisoformat(data[domain])
        if datetime.utcnow() < until:
            raise RuntimeError(
                f"Domain {domain!r} is backed off until {until.isoformat()}. "
                "Delete backoff.json or wait to retry."
            )


def set_backoff(domain: str, minutes: int = 30) -> None:
    from datetime import timedelta
    data = _load_backoff()
    data[domain] = (datetime.utcnow() + timedelta(minutes=minutes)).isoformat()
    _save_backoff(data)
    log.warning("Set backoff for %s for %d minutes", domain, minutes)


# ---------------------------------------------------------------------------
# JSONP / API helpers
# ---------------------------------------------------------------------------

def _strip_jsonp(text: str) -> dict:
    """Strip JSONP callback wrapper and return parsed dict."""
    start = text.index("(") + 1
    end = text.rindex(")")
    return json.loads(text[start:end])


def _api_params(**kwargs) -> dict:
    """Build common ARI API params."""
    params = {
        "arik": ARI_API_KEY,
        "aril": "en-US",
        "ariv": ARI_PAGE_URL,
        "responsive": "true",
        "cb": "ariCallback",
    }
    params.update(kwargs)
    return params


def call_api(
    session: requests.Session,
    wc: WebCacheClient,
    endpoint: str,
    params: dict,
) -> dict:
    """
    Fetch a JSONP endpoint, using webcache for deduplication.
    Handles 429 via backoff. Returns parsed JSON dict.
    """
    url = f"{ARI_BASE_URL}/{endpoint}"
    full_url = url + "?" + urlencode(params)

    # Check webcache
    try:
        cached = wc.get(full_url)
        if cached:
            return _strip_jsonp(cached["content"])
    except Exception as e:
        log.debug("Webcache lookup failed: %s", e)

    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))

    for attempt in range(3):
        try:
            resp = session.get(url, params=params, timeout=30)
        except requests.RequestException as e:
            log.error("Request error on %s: %s", endpoint, e)
            time.sleep(5 * (attempt + 1))
            continue

        if resp.status_code == 429:
            log.warning("429 on %s — backing off 30 min", endpoint)
            set_backoff(DOMAIN, 30)
            raise RuntimeError("Rate limited (429)")

        if resp.status_code != 200:
            log.warning("HTTP %s on %s — attempt %d", resp.status_code, endpoint, attempt + 1)
            time.sleep(5 * (attempt + 1))
            continue

        text = resp.text

        # Store in webcache
        try:
            wc.store(url=full_url, content=text, client_name=CACHE_CLIENT_NAME)
        except Exception as e:
            log.debug("Webcache store failed: %s", e)

        return _strip_jsonp(text)

    raise RuntimeError(f"Failed to fetch {endpoint} after 3 attempts")


def get_assembly_children(
    session: requests.Session,
    wc: WebCacheClient,
    arib: str = ARI_BRAND,
    aria: Optional[str] = None,
    include_imgs: bool = False,
) -> list[dict]:
    """
    Call GetAssembly to list children of a folder (or root if aria is None).
    Returns list of item dicts with keys: data (label), attr (aria, rel, slug, src).
    """
    params = _api_params(arib=arib)
    if aria:
        params["aria"] = aria
    if include_imgs:
        params["includeImgs"] = "true"

    data = call_api(session, wc, "GetAssembly", params)

    # The response is a list of items
    items = data if isinstance(data, list) else data.get("data", [])
    return items


def get_assembly_detail(
    session: requests.Session,
    wc: WebCacheClient,
    slug: str,
) -> tuple[Optional[str], list[dict]]:
    """
    Call GetDetails for a specific assembly slug.
    Returns (image_url, parts_list).
    parts_list: list of {ref, part_number, description, price}
    """
    params = _api_params(ariq=slug)
    data = call_api(session, wc, "GetDetails", params)

    # GetDetails returns HTML in a "data" key
    html = data.get("data", "") if isinstance(data, dict) else ""
    if not html:
        # Sometimes the payload itself is HTML
        html = data if isinstance(data, str) else ""

    soup = BeautifulSoup(html, "lxml")

    # Diagram image
    img_tag = soup.find("img", id="ariparts_image") or soup.find("img", class_=re.compile(r"ariparts", re.I))
    image_url: Optional[str] = None
    if img_tag and img_tag.get("src"):
        raw_src = img_tag["src"].split("?")[0]
        image_url = raw_src if raw_src.startswith("http") else None

    # Parts rows
    parts: list[dict] = []
    for row in soup.find_all("tr", class_="ariPartInfo"):
        ref_td = row.find("td", class_="ariPLTag")
        sku_span = row.find("span", class_="ariPLSku")
        desc_td = row.find("td", class_="ariPLDesc")
        price_td = row.find("td", class_=re.compile(r"ariPLPrice|ariPLSku", re.I))

        part_number = ""
        if sku_span:
            part_number = sku_span.get("name", "") or sku_span.text.strip()
        elif desc_td:
            # fallback: look for data attribute
            part_number = row.get("data-part", "")

        description = desc_td.text.strip() if desc_td else ""
        ref_number = ref_td.text.strip() if ref_td else ""

        price = ""
        if price_td:
            price = (
                price_td.get("adjustedprice")
                or price_td.get("price")
                or price_td.text.strip()
            )

        if part_number or description:
            parts.append(
                {
                    "ref": ref_number,
                    "part_number": part_number,
                    "description": description,
                    "price": price,
                }
            )

    return image_url, parts


# ---------------------------------------------------------------------------
# imgcache helper
# ---------------------------------------------------------------------------

def cache_image(
    img_url: str,
    http_session: requests.Session,
    ic: ImgCacheClient,
) -> Optional[str]:
    """
    Return the imgcache content_hash for img_url, downloading if not cached.
    Returns None on any failure.
    """
    if not img_url:
        return None
    try:
        existing = ic.lookup(img_url)
        if existing:
            return existing.get("content_hash")

        resp = http_session.get(img_url, timeout=30)
        resp.raise_for_status()

        filename = Path(urlparse(img_url).path).name or "diagram.jpg"
        result = ic.store(
            url=img_url,
            file_bytes=resp.content,
            client_name=CACHE_CLIENT_NAME,
            filename=filename,
        )
        return result.get("content_hash")
    except Exception as e:
        log.warning("Failed to cache image %s: %s", img_url, e)
        return None


# ---------------------------------------------------------------------------
# Name parsing
# ---------------------------------------------------------------------------

_MODEL_RE = re.compile(
    r"^(?P<model_code>[A-Z0-9]+)\s+(?P<trim_code>[A-Z0-9]+)\s+(?P<model_name>.+?)\s+\((?P<year>\d{4})\)$"
)


def parse_model_label(label: str) -> dict:
    """
    Parse a label like 'FLFBS 1YGK FAT BOY 114 (2024)' into components.
    Falls back gracefully if pattern doesn't match.
    """
    m = _MODEL_RE.match(label.strip())
    if m:
        return m.groupdict()
    # Fallback
    year_m = re.search(r"\((\d{4})\)", label)
    return {
        "year": year_m.group(1) if year_m else "unknown",
        "model_code": "",
        "trim_code": "",
        "model_name": label,
    }


# ---------------------------------------------------------------------------
# DB upsert helpers
# ---------------------------------------------------------------------------

def get_or_create_motorcycle(
    db: Session,
    year: str,
    model_code: str,
    trim_code: str,
    model_name: str,
    model_category: str,
    aria_code: str,
    full_name: str,
) -> Motorcycle:
    moto = (
        db.query(Motorcycle)
        .filter_by(year=year, model_code=model_code, trim_code=trim_code)
        .first()
    )
    if not moto:
        moto = Motorcycle(
            year=year,
            model_code=model_code,
            trim_code=trim_code,
            model_name=model_name,
            model_category=model_category,
            aria_code=aria_code,
            full_name=full_name,
            source_url=ARI_PAGE_URL,
        )
        db.add(moto)
        db.flush()
    return moto


def get_or_create_part(db: Session, part_number: str, description: str) -> Part:
    part = db.query(Part).filter_by(part_number=part_number).first()
    if not part:
        part = Part(part_number=part_number, description=description)
        db.add(part)
        db.flush()
    return part


def get_or_create_diagram(
    db: Session,
    aria_code: str,
    name: str,
    slug: str,
    image_url: Optional[str],
    image_content_hash: Optional[str],
) -> Diagram:
    diagram = db.query(Diagram).filter_by(aria_code=aria_code).first()
    if not diagram:
        diagram = Diagram(
            aria_code=aria_code,
            name=name,
            slug=slug,
            image_url=image_url,
            image_content_hash=image_content_hash,
        )
        db.add(diagram)
        db.flush()
    elif image_content_hash and not diagram.image_content_hash:
        diagram.image_content_hash = image_content_hash
        db.flush()
    return diagram


def link_diagram_part(db: Session, diagram: Diagram, part: Part, ref: str, price: str):
    existing = (
        db.query(DiagramPart)
        .filter_by(diagram_id=diagram.id, part_id=part.id, ref_number=ref)
        .first()
    )
    if not existing:
        dp = DiagramPart(
            diagram_id=diagram.id,
            part_id=part.id,
            ref_number=ref,
            price=price or None,
        )
        db.add(dp)
        db.flush()


# ---------------------------------------------------------------------------
# Scraping logic
# ---------------------------------------------------------------------------

def scrape_assembly(
    db: Session,
    http_session: requests.Session,
    wc: WebCacheClient,
    ic: ImgCacheClient,
    moto: Motorcycle,
    assembly_item: dict,
) -> None:
    """Scrape one leaf assembly: fetch details, cache image, save parts."""
    attr = assembly_item.get("attr", {})
    aria = attr.get("aria", "")
    slug = attr.get("slug", "")
    name = assembly_item.get("data", "Unknown Assembly")
    thumb_url = attr.get("src", "")

    log.info("    Assembly: %s [%s]", name, aria)

    try:
        image_url, parts = get_assembly_detail(http_session, wc, slug)
    except Exception as e:
        log.error("    Failed to get details for assembly %s: %s", aria, e)
        return

    # Use thumb if no full-size image
    if not image_url and thumb_url:
        image_url = thumb_url

    content_hash = cache_image(image_url, http_session, ic) if image_url else None

    diagram = get_or_create_diagram(db, aria, name, slug, image_url, content_hash)
    diagram.scraped_at = datetime.utcnow()

    # Link motorcycle ↔ diagram
    if moto not in diagram.motorcycles:
        diagram.motorcycles.append(moto)
    db.flush()

    # Save parts
    for p in parts:
        part_num = p["part_number"]
        if not part_num:
            continue
        part = get_or_create_part(db, part_num, p["description"])
        link_diagram_part(db, diagram, part, p["ref"], p["price"])

        # Link motorcycle ↔ part (M2M)
        if moto not in part.motorcycles:
            part.motorcycles.append(moto)
        db.flush()

    log.info("      Saved %d parts for diagram %s", len(parts), name)


def scrape_model_trim(
    db: Session,
    http_session: requests.Session,
    wc: WebCacheClient,
    ic: ImgCacheClient,
    moto: Motorcycle,
) -> None:
    """Fetch all assemblies under a model/trim and scrape each one."""
    if not moto.aria_code:
        return

    log.info("  Scraping model: %s %s %s", moto.year, moto.model_code, moto.model_name)

    assemblies = get_assembly_children(http_session, wc, aria=moto.aria_code, include_imgs=True)

    for item in assemblies:
        if _shutdown:
            break
        attr = item.get("attr", {})
        rel = attr.get("rel", "")

        if rel == "assembly":
            scrape_assembly(db, http_session, wc, ic, moto, item)
        elif rel == "folder":
            # Sub-folder (system level), recurse one level
            sub_aria = attr.get("aria", "")
            sub_name = item.get("data", "")
            log.info("  Sub-folder: %s [%s]", sub_name, sub_aria)
            sub_items = get_assembly_children(http_session, wc, aria=sub_aria, include_imgs=True)
            for sub_item in sub_items:
                if _shutdown:
                    break
                sub_attr = sub_item.get("attr", {})
                if sub_attr.get("rel") == "assembly":
                    scrape_assembly(db, http_session, wc, ic, moto, sub_item)

    moto.scraped_at = datetime.utcnow()
    db.commit()
    log.info("  Committed model %s %s", moto.year, moto.model_code)


def scrape_all(
    db: Session,
    http_session: requests.Session,
    wc: WebCacheClient,
    ic: ImgCacheClient,
) -> None:
    """Main traversal: Year → Category → Model/Trim."""
    log.info("Fetching year list...")
    years = get_assembly_children(http_session, wc)
    log.info("Found %d years", len(years))

    for year_item in years:
        if _shutdown:
            break
        year_attr = year_item.get("attr", {})
        year_aria = year_attr.get("aria", "")
        year_label = year_item.get("data", "")
        year_str = year_label.strip()
        log.info("Year: %s [%s]", year_str, year_aria)

        categories = get_assembly_children(http_session, wc, aria=year_aria)
        for cat_item in categories:
            if _shutdown:
                break
            cat_attr = cat_item.get("attr", {})
            cat_aria = cat_attr.get("aria", "")
            cat_name = cat_item.get("data", "")
            cat_rel = cat_attr.get("rel", "")
            log.info(" Category: %s [%s]", cat_name, cat_aria)

            if cat_rel == "assembly":
                # Leaf at category level — unusual but handle it
                parsed = parse_model_label(cat_name)
                moto = get_or_create_motorcycle(
                    db,
                    year=parsed.get("year", year_str),
                    model_code=parsed.get("model_code", cat_aria),
                    trim_code=parsed.get("trim_code", ""),
                    model_name=parsed.get("model_name", cat_name),
                    model_category="",
                    aria_code=cat_aria,
                    full_name=cat_name,
                )
                db.commit()
                if not moto.scraped_at:
                    scrape_model_trim(db, http_session, wc, ic, moto)
                continue

            # Category is a folder — list models/trims
            models = get_assembly_children(http_session, wc, aria=cat_aria)
            for model_item in models:
                if _shutdown:
                    break
                model_attr = model_item.get("attr", {})
                model_aria = model_attr.get("aria", "")
                model_label = model_item.get("data", "")
                model_rel = model_attr.get("rel", "")

                # Parse model label
                parsed = parse_model_label(model_label)
                moto_year = parsed.get("year") or year_str
                model_code = parsed.get("model_code") or model_aria
                trim_code = parsed.get("trim_code") or ""
                model_name = parsed.get("model_name") or model_label

                if model_rel == "assembly":
                    # Direct assembly at model level
                    moto = get_or_create_motorcycle(
                        db,
                        year=moto_year,
                        model_code=model_code,
                        trim_code=trim_code,
                        model_name=model_name,
                        model_category=cat_name,
                        aria_code=model_aria,
                        full_name=model_label,
                    )
                    db.commit()
                    if not moto.scraped_at:
                        scrape_model_trim(db, http_session, wc, ic, moto)
                    continue

                # model_rel == "folder" — could be trim level or system level
                # Try to detect: if children are all assemblies → it's a model/trim
                moto = get_or_create_motorcycle(
                    db,
                    year=moto_year,
                    model_code=model_code,
                    trim_code=trim_code,
                    model_name=model_name,
                    model_category=cat_name,
                    aria_code=model_aria,
                    full_name=model_label,
                )
                db.commit()

                if moto.scraped_at:
                    log.info("  Skipping already-scraped: %s %s", moto.year, moto.model_code)
                    continue

                scrape_model_trim(db, http_session, wc, ic, moto)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    check_backoff(DOMAIN)
    init_db()

    http_session = requests.Session()
    http_session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Referer": "https://www.harley-davidson.com/",
            "Accept": "text/javascript, application/javascript, */*",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    wc = WebCacheClient(WEBCACHE_URL)
    ic = ImgCacheClient(IMGCACHE_URL)

    try:
        scrape_all(db=SessionFactory(), http_session=http_session, wc=wc, ic=ic)
    except RuntimeError as e:
        log.error("Fatal: %s", e)
        sys.exit(1)
    finally:
        wc._http.close()
        ic._client.close()
        http_session.close()

    log.info("Done.")


if __name__ == "__main__":
    main()
