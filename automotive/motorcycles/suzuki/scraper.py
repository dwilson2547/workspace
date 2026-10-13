#!/usr/bin/env python3
# Site: Babbitt's Suzuki Parts House — suzukipartshouse.com
# Strategy: playwright-rendered + stealth (Cloudflare managed challenge blocks
#   plain requests AND plain headless Chromium; playwright-stealth passes it)
# Discovered endpoint / base URL:
#   https://www.suzukipartshouse.com/oemparts/c/suzuki_motorcycle/parts
# Last recon: 2026-10-13
#
# URL hierarchy
# -------------
# /oemparts/c/suzuki_motorcycle/parts                     root (year list)
# /oemparts/c/suzuki_motorcycle_{YEAR}/parts              year  → model list
# /oemparts/l/suz/{MODEL_ID}/{YEAR}-{MODEL_SLUG}-parts    model → diagram list
# /oemparts/a/suz/{ASSEMBLY_ID}/{DIAGRAM_SLUG}            diagram → parts table
#
# Diagram images: media.vxt.production.ldv-svcs.live (plain CDN, not challenged).
#
# Every page render happens only on a webcache miss; the Cloudflare challenge is
# detected ("Just a moment…") and given up to CHALLENGE_WAIT_MS to clear —
# stealth usually passes it during goto. A challenge that never clears aborts
# the run gracefully (partial result, exit 0); the next run resumes.
#
# Runs under scrape-job-manager (scrape_contract exit codes + result payload).
# Page navigations run under request-auth permits (the domain is paced at
# 1 req/30s via the request-auth API — well above the old robots.txt
# Crawl-delay: 10); pages through webcache; diagram images through imgcache.
# Progress is resume-safe (scraped_at).

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
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth
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
    BASE_URL,
    CACHE_BUCKET,
    CACHE_CLIENT_NAME,
    CHALLENGE_POLL_MS,
    CHALLENGE_WAIT_MS,
    IMGCACHE_URL,
    MAX_RETRIES,
    MEDIA_DOMAIN,
    PAGE_TIMEOUT_MS,
    REQUEST_AUTH_SERVER_URL,
    RETRY_BACKOFF_SECONDS,
    ROOT_PARTS_URL,
    SITE_DOMAIN,
    USER_AGENT,
    WEBCACHE_URL,
)

MAKE = "Suzuki"

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
)
logger = logging.getLogger(__name__)

# ── SELECTORS (update here when the site redesigns) ──────────────────────────

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
    "ref_num":        ".c0",
    "part_name":      ".c1a span",
    "part_number":    ".itemnum",
    "price":          ".c2 .dbl",
    "qty_input":      "input[name='qty']",
    "part_url":       ".c1b a",
    # Diagram image
    "diagram_img":    "#diagram img",
    # Page title
    "page_h1":        "h1",
    # Selector that signals a listing page is fully loaded
    "model_ready":    "a[href*='/oemparts/l/suz/']",
    "diagram_ready":  ".partlistrow",
}

CHALLENGE_MARKER = "Just a moment"


# ── Graceful shutdown ─────────────────────────────────────────────────────────

class ShutdownRequested(Exception):
    """A SIGTERM/SIGINT arrived; stop after the current item and return the result."""


class ChallengeDetected(Exception):
    """The Cloudflare challenge never cleared — abort the run gracefully."""


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


# ── Stealth browser session ──────────────────────────────────────────────────

class BrowserSession:
    """One stealthed Chromium page for the whole run."""

    def __init__(self, request_auth: RequestAuthClient) -> None:
        self._request_auth = request_auth
        self._pw = None
        self._browser = None
        self._page = None

    def start(self) -> None:
        logger.info("Launching stealth Chromium…")
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = self._browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 800},
        )
        self._page = context.new_page()
        Stealth().apply_stealth_sync(self._page)

    def render(self, url: str) -> str:
        """Navigate with a request-auth permit; wait out any Cloudflare challenge."""
        with self._request_auth.acquire(SITE_DOMAIN) as permit:
            resp = self._page.goto(url, timeout=PAGE_TIMEOUT_MS, wait_until="domcontentloaded")
            permit.set_status(resp.status if resp else 200)

        waited = 0
        while CHALLENGE_MARKER in self._page.title() and waited < CHALLENGE_WAIT_MS:
            self._page.wait_for_timeout(CHALLENGE_POLL_MS)
            waited += CHALLENGE_POLL_MS

        if CHALLENGE_MARKER in self._page.title():
            raise ChallengeDetected(url)

        return self._page.content()

    def fresh_page(self) -> None:
        """Replace the page (and its context) — new fingerprint for the next render."""
        try:
            self._page.context.close()
        except Exception:
            pass
        context = self._browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 800},
        )
        self._page = context.new_page()
        Stealth().apply_stealth_sync(self._page)

    def close(self) -> None:
        for closer in (lambda: self._browser.close(), lambda: self._pw.stop()):
            try:
                closer()
            except Exception:
                pass


# ── Webcache-aware page fetcher ───────────────────────────────────────────────

# Consecutive pages whose challenge never cleared. The challenge is
# intermittent (it passes most navigations, sticks on some); a few stuck pages
# in a row means the site is in a bad mood — stop hammering and let the next
# run resume.
_CHALLENGE_STREAK_LIMIT = 5
_challenge_streak = 0


def fetch_page(url: str, browser: BrowserSession, cache: WebCacheClient, ready_selector: str = "h1") -> Optional[str]:
    """
    Return the rendered HTML for *url*, or None when the page could not be
    fetched (challenge stuck / render failed) — the caller skips that item.

    1. Checks WebCache first.
    2. On a cache miss: renders under a request-auth permit (waiting out the
       Cloudflare challenge), waits for *ready_selector*, stores in cache.
    3. Retries up to MAX_RETRIES times with back-off (fresh page on challenge).
    4. Raises ChallengeDetected once _CHALLENGE_STREAK_LIMIT pages in a row
       are stuck — main() turns that into a graceful run abort.
    """
    global _challenge_streak
    url = url.strip()

    try:
        cached = cache.get(url, bucket=CACHE_BUCKET)
        if cached:
            logger.debug("[cache hit] %s", url)
            return cached["content"]
    except Exception as exc:
        logger.warning("WebCache GET failed for %s: %s", url, exc)

    logger.info("[render] %s", url)
    check_shutdown()

    last_exc: Optional[Exception] = None
    html = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            html = browser.render(url)
            # Content is lazy-loaded; wait for the page-type marker.
            try:
                browser._page.wait_for_selector(ready_selector, timeout=15_000, state="attached")
                browser._page.wait_for_timeout(2_000)
                html = browser._page.content()
            except Exception:
                pass  # marker may legitimately be absent on sparse pages
            break
        except ChallengeDetected as exc:
            # One challenge can outlast the wait; a fresh page (new fingerprint)
            # often clears it. Give every attempt its own chance.
            last_exc = exc
            logger.warning("Challenge stuck on %s (attempt %d/%d) — fresh page and retry",
                           url, attempt, MAX_RETRIES)
            check_shutdown()
            if attempt < MAX_RETRIES:
                browser.fresh_page()
                time.sleep(RETRY_BACKOFF_SECONDS)
        except ShutdownRequested:
            raise
        except Exception as exc:
            last_exc = exc
            logger.warning("Render error %s (attempt %d/%d): %s", url, attempt, MAX_RETRIES, exc)
            check_shutdown()
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS)
    else:
        if isinstance(last_exc, ChallengeDetected):
            _challenge_streak += 1
            if _challenge_streak >= _CHALLENGE_STREAK_LIMIT:
                raise ChallengeDetected(
                    f"{url} (streak of {_challenge_streak} pages)"
                ) from last_exc
            return None  # skip this page; the rest of the run continues
        logger.error("Failed to render %s after %d attempts — skipping page",
                     url, MAX_RETRIES)
        return None

    _challenge_streak = 0

    try:
        cache.store(url=url, content=html, client_name=CACHE_CLIENT_NAME, bucket=CACHE_BUCKET)
    except Exception as exc:
        logger.warning("WebCache store failed for %s: %s", url, exc)

    return html


# ── Image persistence (imgcache) ──────────────────────────────────────────────

def persist_image(
    image_url: str,
    request_auth: RequestAuthClient,
    img_cache: ImgCacheClient,
    db_session,
) -> Optional[int]:
    """Download *image_url* (CDN, unchallenged) and store it via imgcache."""
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
            with request_auth.acquire(MEDIA_DOMAIN) as permit:
                r = httpx.get(image_url, timeout=30, follow_redirects=True)
                permit.set_status(r.status_code)
            r.raise_for_status()
            data = r.content
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


# ── URL helpers ───────────────────────────────────────────────────────────────

def extract_year_from_url(url: str) -> Optional[str]:
    m = re.search(r"suzuki_motorcycle_(\d{4})", url)
    return m.group(1) if m else None


def extract_model_external_id(url: str) -> Optional[str]:
    m = re.search(r"/oemparts/l/suz/([a-f0-9]+)/", url)
    return m.group(1) if m else None


def abs_url(href: str) -> str:
    if href.startswith("http"):
        return href
    return BASE_URL + href


# ── Extraction helpers (BeautifulSoup) ────────────────────────────────────────

def extract_year_urls(html: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    urls = []
    for a in soup.select(SELECTORS["year_link"]):
        href = a.get("href", "")
        if href and "/oemparts/c/suzuki_motorcycle_" in href:
            urls.append(abs_url(href))
    return list(dict.fromkeys(urls))


def extract_model_links(html: str) -> list[dict]:
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
    soup = BeautifulSoup(html, "lxml")
    h1 = soup.select_one(SELECTORS["page_h1"])
    if h1:
        text = h1.get_text(strip=True)
        return re.sub(r"\s+OEM\s+Parts$", "", text, flags=re.IGNORECASE).strip()
    return None


def extract_parts_from_html(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    parts = []
    for row in soup.select(SELECTORS["part_row"]):
        ref_el = row.select_one(SELECTORS["ref_num"])
        ref_num = ref_el.get_text(strip=True) if ref_el else ""

        name_el = row.select_one(SELECTORS["part_name"]) or row.select_one(".c1a")
        part_name = name_el.get_text(strip=True) if name_el else ""

        num_el = row.select_one(SELECTORS["part_number"])
        part_number = num_el.get_text(strip=True) if num_el else ""

        form = row.find("form")
        if not part_number and form:
            part_number = form.get("data-sku", "").strip()
        if not part_name and form:
            part_name = form.get("data-name", "").strip()

        price_el = row.select_one(SELECTORS["price"])
        price = price_el.get_text(strip=True) if price_el else ""

        qty_el = row.select_one(SELECTORS["qty_input"])
        quantity = None
        if qty_el:
            try:
                quantity = int(qty_el.get("value", "1").strip())
            except ValueError:
                quantity = None

        part_link = row.select_one(SELECTORS["part_url"])
        part_url = abs_url(part_link["href"]) if part_link and part_link.get("href") else ""

        if part_number:
            # Leading dots in some names mark sub-positions; strip them.
            part_name = part_name.lstrip(".").strip()
            parts.append({
                "ref_num":     ref_num,
                "part_number": part_number,
                "part_name":   part_name,
                "price":       price,
                "quantity":    quantity,
                "part_url":    part_url,
            })

    return parts


def extract_diagram_image_url(html: str) -> Optional[str]:
    soup = BeautifulSoup(html, "lxml")
    img = soup.select_one(SELECTORS["diagram_img"])
    return img.get("src") if img else None


# ── Database helpers ──────────────────────────────────────────────────────────

def upsert_motorcycle(
    db_session,
    *,
    year: str,
    model_code: str,
    model_name: str,
    variant_key: str,
    source_url: str,
) -> Motorcycle:
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
        year=year,
        model_code=model_code,
        model_name=model_name or model_code,
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


# ── Core scraping logic ───────────────────────────────────────────────────────

def scrape_diagram(
    diagram_url: str,
    diagram_title: str,
    moto: Motorcycle,
    browser: BrowserSession,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    request_auth: RequestAuthClient,
    db_session,
    counters: dict,
) -> None:
    existing = db_session.query(Diagram).filter_by(source_url=diagram_url).first()
    if existing and existing.scraped_at:
        logger.debug("Already scraped diagram: %s", diagram_title)
        return

    try:
        html = fetch_page(diagram_url, browser, cache, ready_selector=SELECTORS["diagram_ready"])
    except ChallengeDetected:
        raise
    except Exception as exc:
        logger.error("Skipping diagram %s: %s", diagram_url, exc)
        return
    if html is None:
        return

    parts = extract_parts_from_html(html)
    image_url = extract_diagram_image_url(html)
    image_id = persist_image(image_url, request_auth, img_cache, db_session)

    if existing:
        existing.image_id = image_id
        existing.scraped_at = datetime.now(timezone.utc)
        diagram = existing
    else:
        diagram = Diagram(
            title=diagram_title,
            category_id=None,   # the catalogue lists diagrams flat per model
            image_id=image_id,
            source_url=diagram_url,
            scraped_at=datetime.now(timezone.utc),
        )
        db_session.add(diagram)
        db_session.flush()

    if moto not in diagram.motorcycles:
        diagram.motorcycles.append(moto)

    seen_dp: set[tuple[int, int]] = set()
    for existing_dp in db_session.query(DiagramPart).filter_by(diagram_id=diagram.id).all():
        seen_dp.add((existing_dp.diagram_id, existing_dp.part_id))

    for p in parts:
        part = upsert_part(db_session, p["part_number"], p["part_name"])
        counters["parts_seen"] += 1

        key = (diagram.id, part.id)
        if key not in seen_dp:
            seen_dp.add(key)
            db_session.add(
                DiagramPart(
                    diagram_id=diagram.id,
                    part_id=part.id,
                    ref_num=p["ref_num"],
                    quantity=p["quantity"],
                    extras={"price": p["price"], "part_url": p["part_url"]},
                )
            )
            counters["parts_new"] += 1

        if part not in moto.parts:
            moto.parts.append(part)

    db_session.commit()
    counters["diagrams"] += 1
    logger.info("    ✓ %s — %d parts", diagram_title, len(parts))


def scrape_model(
    model_info: dict,
    year: str,
    browser: BrowserSession,
    cache: WebCacheClient,
    img_cache: ImgCacheClient,
    request_auth: RequestAuthClient,
    db_session,
    counters: dict,
) -> None:
    model_url = model_info["url"]
    model_code = model_info["link_text"]

    variant_key = extract_model_external_id(model_url) or model_url
    moto = upsert_motorcycle(
        db_session,
        year=year,
        model_code=model_code,
        model_name="",
        variant_key=variant_key,
        source_url=model_url,
    )
    db_session.commit()

    if moto.scraped_at:
        logger.debug("Already fully scraped: %s %s", year, model_code)
        return

    try:
        html = fetch_page(model_url, browser, cache, ready_selector=SELECTORS["model_ready"])
    except ChallengeDetected:
        raise
    except Exception as exc:
        logger.error("Skipping model %s: %s", model_url, exc)
        return
    if html is None:
        return

    model_name = extract_model_name_from_html(html)
    if model_name and not moto.model_name or moto.model_name == model_code:
        moto.model_name = model_name or model_code
        db_session.commit()

    diagram_links = extract_diagram_links(html)
    if not diagram_links:
        logger.warning("No diagrams for %s (%s)", model_code, model_url)
        moto.scraped_at = datetime.now(timezone.utc)
        db_session.commit()
        return

    logger.info("  %s %s — %d diagrams", year, moto.model_name, len(diagram_links))

    for diag in diagram_links:
        check_shutdown()
        scrape_diagram(
            diag["url"], diag["title"], moto,
            browser, cache, img_cache, request_auth, db_session, counters,
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

    logger.info("=== Suzuki parts scraper starting ===")

    browser = BrowserSession(request_auth)
    browser.start()

    total_models = 0
    aborted = False
    try:
        with SessionFactory() as db_session:
            # ── Step 1: years ────────────────────────────────────────────
            root_html = fetch_page(ROOT_PARTS_URL, browser, cache, ready_selector=SELECTORS["year_link"])
            if root_html is None:
                raise Broken("root parts page blocked by the Cloudflare challenge")
            year_urls = extract_year_urls(root_html)
            logger.info("Found %d years", len(year_urls))

            for year_url in year_urls:
                check_shutdown()
                year = extract_year_from_url(year_url) or ""
                logger.info("── %s ──", year)

                try:
                    year_html = fetch_page(year_url, browser, cache, ready_selector=SELECTORS["model_ready"])
                except ChallengeDetected:
                    raise
                except Exception as exc:
                    logger.error("Skipping year %s: %s", year_url, exc)
                    continue
                if year_html is None:
                    continue

                model_links = extract_model_links(year_html)
                total_models += len(model_links)

                for model_info in model_links:
                    check_shutdown()
                    scrape_model(
                        model_info, year,
                        browser, cache, img_cache, request_auth, db_session, counters,
                    )
    except ShutdownRequested:
        logger.info("Graceful shutdown: returning partial result.")
    except ChallengeDetected as exc:
        aborted = True
        logger.error("Cloudflare challenge did not clear for %s — aborting run.", exc)
    finally:
        browser.close()
        request_auth.close()

    if total_models == 0 and not aborted:
        raise Broken("enumeration found no models — site or selector drift?")

    logger.info("=== Scraping complete ===" if not aborted
                else "=== Run aborted at the Cloudflare challenge ===")
    return {
        "items": counters["diagrams"],
        "new": counters["parts_new"],
        "motorcycles": counters["motorcycles"],
        "message": "cloudflare challenge — aborted run, resume next run"
                   if aborted else "ok",
    }


if __name__ == "__main__":
    run(main)
