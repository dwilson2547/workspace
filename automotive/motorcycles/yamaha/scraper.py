"""
Yamaha motorcycle parts scraper.

Strategy:
  1. Launch Playwright to capture the anonymous JWT Bearer token.
  2. Use httpx + the token to enumerate years → models via the Yamaha API.
  3. For each model, fetch the _next/data JSON to get diagrams.
  4. For each diagram, fetch the _next/data JSON to get parts (no browser rendering needed).
  5. Fetch diagram images via the API (base64 PNG).
  6. Persist everything to SQLite via SQLAlchemy.
  7. Cache all JSON responses locally with lz4 compression.
"""

import base64
import hashlib
import json
import logging
import random
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from playwright.sync_api import sync_playwright
from sqlalchemy.exc import IntegrityError

import cache
from config import (
    API_BASE,
    BASE_URL,
    DELAY_MAX_SECONDS,
    DELAY_MIN_SECONDS,
    IMAGES_DIR,
    PARTS_MOTORCYCLE_URL,
    USER_AGENT,
)
from db import Diagram, DiagramPart, Image, Motorcycle, Part, get_session, init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler()],
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------
_shutdown = False


def _handle_signal(signum, frame):
    global _shutdown
    log.info("Shutdown signal received, finishing current item...")
    _shutdown = True


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)


def check_shutdown():
    if _shutdown:
        log.info("Graceful shutdown complete.")
        sys.exit(0)


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
def delay():
    time.sleep(random.uniform(DELAY_MIN_SECONDS, DELAY_MAX_SECONDS))


# ---------------------------------------------------------------------------
# Auth: capture Bearer token via Playwright
# ---------------------------------------------------------------------------
_token: str | None = None
_token_exp: float = 0.0


def _acquire_token() -> str:
    """Launch a headless browser, load the parts page, intercept the JWT."""
    captured: list[str] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT)
        page = context.new_page()

        def on_request(request):
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer ") and not captured:
                captured.append(auth.split(" ", 1)[1])

        page.on("request", on_request)
        page.goto(PARTS_MOTORCYCLE_URL, wait_until="networkidle", timeout=60_000)
        browser.close()

    if not captured:
        raise RuntimeError("Failed to capture Bearer token from Yamaha site.")
    return captured[0]


def _decode_exp(token: str) -> float:
    """Decode JWT exp field (no signature verification needed)."""
    try:
        payload_b64 = token.split(".")[1]
        # Fix padding
        payload_b64 += "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.b64decode(payload_b64))
        return float(payload.get("exp", 0))
    except Exception:
        return 0.0


def get_token() -> str:
    global _token, _token_exp
    now = time.time()
    if _token is None or now >= _token_exp - 300:  # refresh 5 min before expiry
        log.info("Acquiring new Bearer token...")
        _token = _acquire_token()
        _token_exp = _decode_exp(_token)
        log.info("Token acquired, expires at %s", datetime.fromtimestamp(_token_exp))
    return _token


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
def _make_client() -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": USER_AGENT},
        timeout=30.0,
        follow_redirects=True,
    )


def fetch_json(client: httpx.Client, url: str, use_cache: bool = True) -> dict:
    """Fetch JSON from URL, using local lz4 cache. Refreshes token on 401."""
    if use_cache:
        cached = cache.get(url)
        if cached:
            return json.loads(cached)

    token = get_token()
    for attempt in range(3):
        try:
            resp = client.get(url, headers={"Authorization": f"Bearer {token}"})
            if resp.status_code == 401:
                log.warning("401 on %s, re-acquiring token...", url)
                global _token
                _token = None
                token = get_token()
                continue
            resp.raise_for_status()
            data = resp.json()
            if use_cache:
                cache.store(url, json.dumps(data))
            return data
        except httpx.HTTPStatusError as exc:
            log.warning("HTTP %s on %s (attempt %d)", exc.response.status_code, url, attempt + 1)
            if attempt < 2:
                time.sleep(30.0)
    raise RuntimeError(f"Failed to fetch {url} after 3 attempts")


def _get_build_id(client: httpx.Client) -> str:
    """Fetch buildId from Next.js __NEXT_DATA__ on the main parts page."""
    cached = cache.get("__build_id__")
    if cached:
        return cached.strip()

    resp = client.get(PARTS_MOTORCYCLE_URL, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    html = resp.text
    # Extract buildId from __NEXT_DATA__ JSON
    marker = '"buildId":"'
    idx = html.find(marker)
    if idx == -1:
        raise RuntimeError("Could not find Next.js buildId in page HTML")
    start = idx + len(marker)
    end = html.index('"', start)
    build_id = html[start:end]
    cache.store("__build_id__", build_id)
    log.info("Next.js buildId: %s", build_id)
    return build_id


# ---------------------------------------------------------------------------
# Image persistence
# ---------------------------------------------------------------------------
def persist_image(client: httpx.Client, session, yamaha_image_id: str) -> Image | None:
    """Download diagram image from API and save to IMAGES_DIR. Returns Image ORM object."""
    url = f"{API_BASE}/parts/image/{yamaha_image_id}"
    try:
        data = fetch_json(client, url)
    except Exception as exc:
        log.warning("Failed to fetch image %s: %s", yamaha_image_id, exc)
        return None

    img_data_uri = data.get("data", {}).get("image", "")
    if not img_data_uri:
        return None

    # Decode base64 PNG
    if "," in img_data_uri:
        img_bytes = base64.b64decode(img_data_uri.split(",", 1)[1])
    else:
        img_bytes = base64.b64decode(img_data_uri)

    sha256 = hashlib.sha256(img_bytes).hexdigest()

    existing = session.query(Image).filter_by(sha256=sha256).first()
    if existing:
        return existing

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    img_path = IMAGES_DIR / f"{sha256}.png"
    if not img_path.exists():
        img_path.write_bytes(img_bytes)

    img_obj = Image(
        sha256=sha256,
        local_path=str(img_path.relative_to(Path(__file__).parent)),
        source_image_id=str(yamaha_image_id),
    )
    session.add(img_obj)
    session.flush()
    return img_obj


# ---------------------------------------------------------------------------
# Scraping helpers
# ---------------------------------------------------------------------------
def get_or_create_part(session, item: dict) -> Part:
    part_number = item["partNumber"]
    part = session.query(Part).filter_by(part_number=part_number).first()
    if part is None:
        part = Part(
            part_number=part_number,
            display_part_number=item.get("displayPartNumber") or item.get("formattedPartNumber"),
            name=item.get("name", "").strip(),
        )
        session.add(part)
        session.flush()
    return part


def scrape_diagram(
    client: httpx.Client,
    session,
    build_id: str,
    motorcycle: Motorcycle,
    diagram_info: dict,
) -> Diagram | None:
    """Fetch diagram page data and persist parts."""
    check_shutdown()

    yamaha_diag_id = diagram_info["id"]
    diag_name = diagram_info["name"]
    image_ids = diagram_info.get("availableImageIds", [])
    yamaha_image_id = str(image_ids[0]) if image_ids else None

    # Check if already scraped
    existing = session.query(Diagram).filter_by(yamaha_diagram_id=yamaha_diag_id).first()
    if existing and existing.scraped_at:
        log.debug("Diagram %s already scraped, skipping.", diag_name)
        if motorcycle not in existing.motorcycles:
            existing.motorcycles.append(motorcycle)
            session.flush()
        return existing

    source_url = f"{BASE_URL}/parts/diagram/{motorcycle.model_id}/{yamaha_diag_id}"
    next_url = (
        f"{BASE_URL}/_next/data/{build_id}/parts/diagram"
        f"/{motorcycle.model_id}/{yamaha_diag_id}.json"
        f"?id=motorcycle&modelId={motorcycle.model_id}&diagramId={yamaha_diag_id}"
    )

    try:
        data = fetch_json(client, next_url)
    except Exception as exc:
        log.warning("Failed to fetch diagram %s: %s", diag_name, exc)
        return None

    items = data.get("pageProps", {}).get("diagram", {}).get("items", [])

    # Persist image
    img_obj = None
    if yamaha_image_id:
        img_obj = persist_image(client, session, yamaha_image_id)
        delay()

    # Upsert diagram
    diagram = existing or session.query(Diagram).filter_by(yamaha_diagram_id=yamaha_diag_id).first()
    if diagram is None:
        diagram = Diagram(
            title=diag_name,
            yamaha_diagram_id=yamaha_diag_id,
            yamaha_image_id=yamaha_image_id,
            source_url=source_url,
        )
        session.add(diagram)

    if img_obj:
        diagram.image_id = img_obj.id

    if motorcycle not in diagram.motorcycles:
        diagram.motorcycles.append(motorcycle)

    session.flush()

    # Persist parts
    for item in items:
        part = get_or_create_part(session, item)
        label = item.get("label", "")
        qty = item.get("qty", "")

        # Add to motorcycle_parts
        if part not in motorcycle.parts:
            motorcycle.parts.append(part)

        # Upsert DiagramPart
        dp = (
            session.query(DiagramPart)
            .filter_by(diagram_id=diagram.id, part_id=part.id, part_index=label)
            .first()
        )
        if dp is None:
            dp = DiagramPart(
                diagram_id=diagram.id,
                part_id=part.id,
                part_index=label,
                quantity=qty,
            )
            session.add(dp)

    diagram.scraped_at = datetime.now(timezone.utc)
    session.commit()
    log.info("  Diagram: %s (%d parts)", diag_name, len(items))
    return diagram


def scrape_model(
    client: httpx.Client,
    session,
    build_id: str,
    year_info: dict,
    model_info: dict,
) -> None:
    """Fetch all diagrams for a given model."""
    check_shutdown()

    model_id = model_info["id"]
    model_name = model_info["name"]
    year_id = year_info["id"]
    year_name = year_info["name"]

    # Check if already fully scraped
    mc = session.query(Motorcycle).filter_by(model_id=model_id).first()
    if mc and mc.scraped_at:
        log.info("Model %s already scraped, skipping.", model_name)
        return

    log.info("Scraping model: %s", model_name)

    # Fetch model page for diagrams list
    next_url = (
        f"{BASE_URL}/_next/data/{build_id}/parts/motorcycle"
        f"/{year_id}/{model_id}.json"
        f"?id=motorcycle&yearId={year_id}&modelId={model_id}"
    )

    try:
        data = fetch_json(client, next_url)
    except Exception as exc:
        log.warning("Failed to fetch model page for %s: %s", model_name, exc)
        return

    page_props = data.get("pageProps", {})
    product = page_props.get("product", {})
    diagrams_list = page_props.get("diagrams", [])

    # Upsert motorcycle
    if mc is None:
        mc = Motorcycle(
            year=year_name,
            make="Yamaha",
            model=product.get("name", model_name),
            model_code=None,
            trim_name=model_name,
            model_id=model_id,
            year_id=year_id,
            source_url=f"{BASE_URL}/parts/motorcycle/{year_id}/{model_id}",
        )
        session.add(mc)
        session.flush()

    delay()

    for diag_info in diagrams_list:
        check_shutdown()
        scrape_diagram(client, session, build_id, mc, diag_info)
        delay()

    mc.scraped_at = datetime.now(timezone.utc)
    session.commit()
    log.info("Finished model: %s", model_name)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    engine = init_db()
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    with _make_client() as client:
        build_id = _get_build_id(client)
        log.info("Using Next.js buildId: %s", build_id)

        # Enumerate years
        years_url = f"{API_BASE}/parts/browse/motorcycle/years"
        years_data = fetch_json(client, years_url)
        years = years_data.get("data", years_data) if isinstance(years_data, dict) else years_data
        if isinstance(years, dict):
            years = years.get("items", years.get("years", []))
        log.info("Found %d years", len(years))

        for year_info in years:
            check_shutdown()
            year_id = year_info["id"]
            year_name = year_info["name"]
            log.info("Year: %s", year_name)

            # Enumerate models for this year
            models_url = f"{API_BASE}/parts/browse/motorcycle/{year_id}/models"
            try:
                models_data = fetch_json(client, models_url)
            except Exception as exc:
                log.warning("Failed to fetch models for year %s: %s", year_name, exc)
                delay()
                continue

            models = models_data.get("data", models_data) if isinstance(models_data, dict) else models_data
            if isinstance(models, dict):
                models = models.get("items", models.get("models", []))

            log.info("  %d models for %s", len(models), year_name)

            with get_session(engine) as session:
                for model_info in models:
                    check_shutdown()
                    scrape_model(client, session, build_id, year_info, model_info)
                    delay()


if __name__ == "__main__":
    main()
