#!/usr/bin/env python3
# Site: Yamaha Motor genuine parts catalogue — yamaha-motor.com/parts
# Strategy: ajax-api (anonymous JWT + JSON APIs; no browser needed)
# Discovered endpoints (recon 2026-10-13):
#   POST https://api.yamaha-motor.com/auth            (no body) → {"token":{"access","refresh"}}
#     — anonymous service token, ~3 h validity; the old per-IP POC API host
#       (yamaha-api-poc-main.prod.yamaha-motor.com) now resolves to private IPs.
#   GET  {API_BASE}/parts/browse/motorcycle/years                 (Bearer)
#   GET  {API_BASE}/parts/browse/motorcycle/{year_id}/models      (Bearer)
#   GET  {BASE_URL}/_next/data/{buildId}/parts/motorcycle/{year_id}/{model_id}.json
#        → pageProps.diagrams: [{id, name, availableImageIds}]
#   GET  {BASE_URL}/_next/data/{buildId}/parts/diagram/0/0/{model_id}/{image_id}.json
#        → pageProps.diagram.items: [{partNumber, displayPartNumber, name, qty,
#           label, product.listPrice, …}] and pageProps.image (base64 PNG data URI)
#   buildId comes from __NEXT_DATA__ on the parts page HTML.
#
# Runs under scrape-job-manager (scrape_contract exit codes + result payload).
# All target-site requests go through request-auth permits; API/JSON responses
# through webcache; diagram images (base64 from the diagram JSON) through
# imgcache. Progress is resume-safe (scraped_at).

import base64
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

from config import (  # noqa: E402
    API_BASE,
    API_DOMAIN,
    AUTH_URL,
    BASE_URL,
    CACHE_BUCKET,
    CACHE_CLIENT_NAME,
    IMGCACHE_URL,
    MAX_RETRIES,
    PAGE_HEADERS,
    PARTS_PAGE_URL,
    REQUEST_AUTH_SERVER_URL,
    RETRY_BACKOFF_SECONDS,
    SITE_DOMAIN,
    WEBCACHE_URL,
)

MAKE = "Yamaha"

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


# ── Auth (anonymous service token) ───────────────────────────────────────────

class TokenError(Exception):
    """Could not obtain or refresh the anonymous service token."""


def _decode_exp(token: str) -> float:
    """Decode the JWT exp field (no signature verification needed)."""
    try:
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.b64decode(payload_b64))
        return float(payload.get("exp", 0))
    except Exception:
        return 0.0


class YamahaToken:
    """Anonymous service token from POST /auth, refreshed 5 min before expiry."""

    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._exp: float = 0.0

    def get(self) -> str:
        now = time.time()
        if self._token is None or now >= self._exp - 300:
            logger.info("Acquiring anonymous service token…")
            try:
                r = httpx.post(AUTH_URL, headers=PAGE_HEADERS, timeout=20)
                r.raise_for_status()
                data = r.json()
                self._token = data["token"]["access"]
            except Exception as exc:
                raise TokenError(str(exc)) from exc
            self._exp = _decode_exp(self._token) or (now + 2 * 3600)
            logger.info("Token acquired (expires %s)", datetime.fromtimestamp(self._exp))
        return self._token

    def invalidate(self) -> None:
        self._token = None


# ── HTTP client (request-auth paced) ──────────────────────────────────────────

class YamahaClient:
    """httpx wrapper: every target request runs under a request-auth permit."""

    def __init__(self, request_auth: RequestAuthClient, token: YamahaToken) -> None:
        self._request_auth = request_auth
        self._token = token
        self._client = httpx.Client(
            headers={"User-Agent": PAGE_HEADERS["User-Agent"]},
            follow_redirects=True,
            timeout=30.0,
        )

    def get_api_json(self, url: str, refresh_on_401: bool = True) -> dict:
        """GET a legacy-API URL with the Bearer token (api.yamaha-motor.com)."""
        headers = dict(PAGE_HEADERS)
        headers["Authorization"] = f"Bearer {self._token.get()}"
        with self._request_auth.acquire(API_DOMAIN) as permit:
            r = self._client.get(url, headers=headers, timeout=30)
            permit.set_status(r.status_code)
        if r.status_code == 401 and refresh_on_401:
            logger.warning("401 on %s — re-acquiring token and retrying.", url)
            self._token.invalidate()
            return self.get_api_json(url, refresh_on_401=False)
        r.raise_for_status()
        return r.json()

    def get_site_text(self, url: str) -> str:
        """GET a yamaha-motor.com URL (no token needed)."""
        with self._request_auth.acquire(SITE_DOMAIN) as permit:
            r = self._client.get(url, headers=PAGE_HEADERS, timeout=30)
            permit.set_status(r.status_code)
        r.raise_for_status()
        return r.text

    def close(self) -> None:
        self._client.close()


# ── Webcache-aware fetchers ───────────────────────────────────────────────────

def fetch_api_json(url: str, client: YamahaClient, cache: WebCacheClient) -> dict:
    """Legacy-API GET via webcache (cache hit avoids a live request entirely).

    A 404 means the catalogue has nothing under this path (several years return
    404 rather than an empty list) — returned as {} without retries.
    """
    try:
        cached = cache.get(url, bucket=CACHE_BUCKET)
        if cached:
            return json.loads(cached["content"])
    except Exception as exc:
        logger.warning("WebCache GET failed for %s: %s", url, exc)

    logger.debug("[api] %s", url)
    check_shutdown()

    last_exc: Optional[Exception] = None
    data = {}
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            data = client.get_api_json(url)
            break
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                logger.info("404 (no catalogue data) for %s — skipping", url)
                return {}
            last_exc = exc
            logger.warning("API error %s (attempt %d/%d): %s", url, attempt, MAX_RETRIES, exc)
            check_shutdown()
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
        except Exception as exc:
            last_exc = exc
            logger.warning("API error %s (attempt %d/%d): %s", url, attempt, MAX_RETRIES, exc)
            check_shutdown()
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    else:
        raise RuntimeError(f"Failed to fetch {url} after {MAX_RETRIES} attempts") from last_exc

    try:
        cache.store(url=url, content=json.dumps(data), client_name=CACHE_CLIENT_NAME, bucket=CACHE_BUCKET)
    except Exception as exc:
        logger.warning("WebCache store failed for %s: %s", url, exc)

    return data


def fetch_site_json(url: str, client: YamahaClient, cache: WebCacheClient) -> dict:
    """_next/data GET on yamaha-motor.com via webcache."""
    try:
        cached = cache.get(url, bucket=CACHE_BUCKET)
        if cached:
            return json.loads(cached["content"])
    except Exception as exc:
        logger.warning("WebCache GET failed for %s: %s", url, exc)

    logger.info("[fetch] %s", url)
    check_shutdown()

    last_exc: Optional[Exception] = None
    text = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            text = client.get_site_text(url)
            data = json.loads(text)
            break
        except Exception as exc:
            last_exc = exc
            logger.warning("Error fetching %s (attempt %d/%d): %s", url, attempt, MAX_RETRIES, exc)
            check_shutdown()
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    else:
        raise RuntimeError(f"Failed to fetch {url} after {MAX_RETRIES} attempts") from last_exc

    try:
        cache.store(url=url, content=text, client_name=CACHE_CLIENT_NAME, bucket=CACHE_BUCKET)
    except Exception as exc:
        logger.warning("WebCache store failed for %s: %s", url, exc)

    return data


def get_build_id(client: YamahaClient, cache: WebCacheClient) -> str:
    """Next.js buildId from the parts page __NEXT_DATA__ (cached)."""
    cache_key = "yamaha://buildid"
    try:
        cached = cache.get(cache_key, bucket=CACHE_BUCKET)
        if cached:
            return cached["content"].strip().strip('"')
    except Exception as exc:
        logger.warning("WebCache GET failed for build id: %s", exc)

    html = client.get_site_text(PARTS_PAGE_URL)
    marker = '"buildId":"'
    idx = html.find(marker)
    if idx == -1:
        raise RuntimeError("Could not find Next.js buildId in parts page HTML")
    start = idx + len(marker)
    build_id = html[start:html.index('"', start)]

    try:
        cache.store(url=cache_key, content=build_id, client_name=CACHE_CLIENT_NAME, bucket=CACHE_BUCKET)
    except Exception as exc:
        logger.warning("WebCache store failed for build id: %s", exc)
    logger.info("Next.js buildId: %s", build_id)
    return build_id


# ── Image persistence (imgcache) ──────────────────────────────────────────────

def persist_image(image_id: str, data_uri: str, img_cache: ImgCacheClient, db_session) -> Optional[int]:
    """Decode the base64 PNG from the diagram JSON and store it via imgcache."""
    if not data_uri or not image_id:
        return None

    try:
        b64 = data_uri.split(",", 1)[1] if "," in data_uri else data_uri
        img_bytes = base64.b64decode(b64)
    except Exception as exc:
        logger.warning("Image decode failed (%s): %s", image_id, exc)
        return None

    source_url = f"{API_BASE}/parts/image/{image_id}"
    try:
        entry = img_cache.store(
            url=source_url, file_bytes=img_bytes,
            client_name=CACHE_CLIENT_NAME, bucket=CACHE_BUCKET,
        )
    except Exception as exc:
        logger.warning("ImgCache store failed for %s: %s", source_url, exc)
        return None

    content_hash = entry.get("content_hash") or entry.get("hash")
    if not content_hash:
        return None

    existing = db_session.query(Image).filter_by(content_hash=content_hash).first()
    if existing:
        return existing.id

    img = Image(content_hash=content_hash, source_url=source_url)
    db_session.add(img)
    db_session.flush()
    return img.id


# ── Database helpers ──────────────────────────────────────────────────────────

_MODEL_NAME_RE = re.compile(r"^(?P<model_code>\S+)\s+\((?P<model_name>.*?)\)\s+(?P<trim_code>\S+)\s+(?P<year>\d{4})$")


def parse_model_label(label: str) -> dict:
    """Parse 'FZ09ECGY (FZ09 CA) 1RC5 2014' into model code / name / trim / year."""
    m = _MODEL_NAME_RE.match(label.strip())
    if m:
        return m.groupdict()
    return {"model_code": label, "model_name": label, "trim_code": "", "year": ""}


def upsert_motorcycle(
    db_session,
    *,
    model_id: str,
    model_label: str,
    year_name: str,
    source_url: str,
) -> Motorcycle:
    parsed = parse_model_label(model_label)
    variant_key = model_id
    moto = (
        db_session.query(Motorcycle)
        .filter_by(make=MAKE, variant_key=variant_key)
        .first()
    )
    if moto:
        return moto
    moto = Motorcycle(
        make=MAKE,
        vehicle_type="Motorcycle",
        year=parsed.get("year") or year_name,
        model_code=parsed.get("model_code") or "",
        model_name=parsed.get("model_name") or model_label,
        trim_name=parsed.get("trim_code") or "",
        variant_key=variant_key,
        source_url=source_url,
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


# ── Diagram-level scraping ────────────────────────────────────────────────────

def scrape_diagram(
    *,
    diag_info: dict,
    model_id: str,
    moto: Motorcycle,
    build_id: str,
    db_session,
    client: YamahaClient,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    counters: dict,
) -> None:
    diag_id = diag_info["id"]
    diag_name = diag_info["name"]
    image_ids = diag_info.get("availableImageIds") or []
    image_id = str(image_ids[0]) if image_ids else ""

    source_url = f"{BASE_URL}/parts/diagram/{model_id}/{diag_id}"
    next_url = (
        f"{BASE_URL}/_next/data/{build_id}/parts/diagram/0/0"
        f"/{model_id}/{image_id or diag_id}.json"
        f"?id=motorcycle&modelId={model_id}&diagramId={diag_id}"
    )

    existing = db_session.query(Diagram).filter_by(source_url=source_url).first()
    if existing and existing.scraped_at:
        logger.debug("Already scraped diagram: %s", diag_name)
        return

    try:
        data = fetch_site_json(next_url, client, cache)
    except Exception as exc:
        logger.error("Skipping diagram %s: %s", diag_name, exc)
        return

    page_props = data.get("pageProps", {})
    items = page_props.get("diagram", {}).get("items", [])
    image_data_uri = page_props.get("image", "")

    # The legacy API behind _next/data only has parts data for a subset of
    # diagrams (many images — title pages, most 2024+ models — return an empty
    # fallback). Recording them would poison the DB with 0-part diagrams;
    # skip instead. Re-runs re-check via webcache hits, so if Yamaha publishes
    # the data later it gets picked up.
    if not items:
        logger.info("    · %s — no parts data published, skipping", diag_name)
        return

    image_row_id = persist_image(image_id, image_data_uri, img_cache, db_session)

    if existing:
        existing.image_id = image_row_id
        existing.scraped_at = datetime.now(timezone.utc)
        diagram = existing
    else:
        diagram = Diagram(
            title=diag_name,
            category_id=None,   # the catalogue has no diagram grouping
            image_id=image_row_id,
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

    for item in items:
        part_number = item.get("partNumber", "")
        if not part_number:
            continue
        part = upsert_part(db_session, part_number, item.get("name", ""))
        counters["parts_seen"] += 1

        try:
            quantity = int(item.get("qty", "")) if item.get("qty") else None
        except (ValueError, TypeError):
            quantity = None

        list_price = None
        product = item.get("product")
        if isinstance(product, dict):
            list_price = product.get("listPrice")

        key = (diagram.id, part.id)
        if key not in seen_dp:
            seen_dp.add(key)
            db_session.add(
                DiagramPart(
                    diagram_id=diagram.id,
                    part_id=part.id,
                    ref_num=str(item.get("label", "")),
                    quantity=quantity,
                    extras={
                        "display_part_number": item.get("displayPartNumber", ""),
                        "price": list_price,
                    },
                )
            )
            counters["parts_new"] += 1

        if part not in moto.parts:
            moto.parts.append(part)

    db_session.commit()
    counters["diagrams"] += 1
    logger.info("    ✓ %s — %d parts", diag_name, len(items))


# ── Model-level scraping ───────────────────────────────────────────────────────

def scrape_model(
    *,
    year_info: dict,
    model_info: dict,
    build_id: str,
    db_session,
    client: YamahaClient,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    counters: dict,
) -> None:
    model_id = model_info["id"]
    model_label = model_info["name"]
    year_id = year_info["id"]
    year_name = year_info["name"]

    moto = upsert_motorcycle(
        db_session,
        model_id=model_id,
        model_label=model_label,
        year_name=year_name,
        source_url=f"{BASE_URL}/parts/motorcycle/{year_id}/{model_id}",
    )
    db_session.commit()

    if moto.scraped_at:
        logger.debug("Already fully scraped: %s", model_label)
        return

    logger.info("  %s [%s]", model_label, year_name)

    model_url = (
        f"{BASE_URL}/_next/data/{build_id}/parts/motorcycle"
        f"/{year_id}/{model_id}.json?id=motorcycle&yearId={year_id}&modelId={model_id}"
    )
    try:
        data = fetch_site_json(model_url, client, cache)
    except Exception as exc:
        logger.error("Skipping model %s: %s", model_label, exc)
        return

    diagrams = data.get("pageProps", {}).get("diagrams", [])
    if not isinstance(diagrams, list):
        diagrams = []

    if not diagrams:
        logger.warning("No diagrams for %s", model_label)
        moto.scraped_at = datetime.now(timezone.utc)
        db_session.commit()
        return

    for diag_info in diagrams:
        check_shutdown()
        scrape_diagram(
            diag_info=diag_info,
            model_id=model_id,
            moto=moto,
            build_id=build_id,
            db_session=db_session,
            client=client,
            cache=cache,
            img_cache=img_cache,
            counters=counters,
        )

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

    logger.info("=== Yamaha parts scraper starting ===")

    token = YamahaToken()
    client = YamahaClient(request_auth, token)

    total_models = 0
    try:
        with SessionFactory() as db_session:
            build_id = get_build_id(client, cache)

            # ── Step 1: years ────────────────────────────────────────────
            years_data = fetch_api_json(f"{API_BASE}/parts/browse/motorcycle/years", client, cache)
            years = years_data.get("data", [])
            logger.info("Found %d years", len(years))

            for year_info in years:
                check_shutdown()
                year_id = year_info["id"]
                year_name = year_info["name"]
                logger.info("── %s ──", year_name)

                # ── Step 2: models for this year ──────────────────────────
                try:
                    models_data = fetch_api_json(
                        f"{API_BASE}/parts/browse/motorcycle/{year_id}/models", client, cache
                    )
                except Exception as exc:
                    logger.error("Skipping year %s: %s", year_name, exc)
                    continue

                models = models_data.get("data", [])
                total_models += len(models)

                for model_info in models:
                    check_shutdown()
                    scrape_model(
                        year_info=year_info,
                        model_info=model_info,
                        build_id=build_id,
                        db_session=db_session,
                        client=client,
                        cache=cache,
                        img_cache=img_cache,
                        counters=counters,
                    )
    except (ShutdownRequested, TokenError) as exc:
        if isinstance(exc, TokenError):
            raise Broken(f"could not obtain yamaha service token: {exc}")
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
