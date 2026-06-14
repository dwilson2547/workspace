#!/usr/bin/env python3
# Site: store.mopar.com
# Strategy: playwright-rendered (Cloudflare blocks requests)
# Data source: sitemaps/sitemap_products_{n}.xml (14 files, ~15k URLs each)
# Target makes: Chrysler, Dodge, Jeep, Ram
# Last recon: 2026-05-05
#
# SELECTORS / fields extracted from inline <script> containing JSON with key "in_rp_catalog":
#   sku, title, description, msrp, price, images, fitment, notes, is_hazmat,
#   also_known_as, positions, applications
# Category / subcategory from JSON-LD BreadcrumbList (positions 3 and 4).

import json
import logging
import re
import time
import random
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, Page, TimeoutError as PWTimeout
from sqlalchemy.orm import Session

from bot_scraper_lib import build_context, RateLimiter, make_record, write_record
from models import (
    init_db,
    Car, Category, Engine, Image, Make, Manufacturer, Model,
    Part, PartImages, SubCategory, Trim, Year,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────

DOMAIN = "store.mopar.com"
BASE_URL = "https://store.mopar.com"
DB_PATH = Path(__file__).parent / "mopar_parts.db"
CHECKPOINT_FILE = Path(__file__).parent / "checkpoint.json"
JSONL_FILE = Path(__file__).parent / f"mopar_parts_{datetime.now():%Y%m%d_%H%M%S}.jsonl"

TARGET_MAKES = {"chrysler", "dodge", "jeep", "ram"}  # lowercase for matching

SITEMAP_URLS = [
    f"https://store.mopar.com/sitemaps/sitemap_products_{n}.xml"
    for n in range(14)
]

SELECTORS = {
    "rp_catalog_script": "script:not([src])",   # inline script containing in_rp_catalog
    "ld_json":           'script[type="application/ld+json"]',
    "wait_for":          "h1",                  # page fully rendered when h1 is present
}

# ── Rate limiter ───────────────────────────────────────────────────────────────

limiter = RateLimiter(DOMAIN, page_delay=(1.5, 2.5), ajax_delay=(0.5, 1.0))

# ── Checkpoint helpers ─────────────────────────────────────────────────────────

def load_checkpoint() -> dict:
    if CHECKPOINT_FILE.exists():
        return json.loads(CHECKPOINT_FILE.read_text())
    return {"sitemaps_done": [], "products_done": [], "products_skipped": []}


def save_checkpoint(cp: dict) -> None:
    CHECKPOINT_FILE.write_text(json.dumps(cp, indent=2))


# ── Playwright helpers ─────────────────────────────────────────────────────────

def dismiss_overlays(page: Page) -> None:
    """Remove modal overlays that block clicks / screenshots."""
    page.evaluate("""() => {
        document.querySelectorAll(
            '#cm-popup-overlay, .modal, .modal-backdrop, #creditCardPromoModal'
        ).forEach(el => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
    }""")


def fetch_page(url: str, page: Page, ctx) -> str:
    """Return rendered HTML, using webcache when available."""
    entry = ctx.web_cache.get(url)
    if entry:
        logger.debug("Cache hit: %s", url)
        # Still navigate so Playwright has the DOM available
        page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        return entry["content"]

    page.goto(url, wait_until="networkidle", timeout=30_000)

    # 429 check — Mopar redirects blocked bots to an error page
    if page.url != url and "blocked" in page.url.lower():
        limiter.ban()

    try:
        page.wait_for_selector(SELECTORS["wait_for"], timeout=10_000)
    except PWTimeout:
        logger.warning("Timeout waiting for h1 on %s", url)

    html = page.content()
    ctx.web_cache.store(url, html, ctx.client_name)
    limiter.wait()
    return html


def parse_inline_json(page: Page) -> dict | None:
    """Extract the in_rp_catalog inline JSON from the rendered page."""
    result = page.evaluate("""() => {
        const script = Array.from(document.querySelectorAll('script:not([src])'))
            .find(s => s.textContent.includes('in_rp_catalog'));
        if (!script) return null;
        try { return JSON.parse(script.textContent.trim()); }
        catch { return null; }
    }""")
    return result


def parse_breadcrumb(page: Page) -> tuple[str | None, str | None]:
    """Return (category_name, subcategory_name) from JSON-LD BreadcrumbList."""
    result = page.evaluate("""() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const s of scripts) {
            try {
                const items = JSON.parse(s.textContent.trim());
                const arr = Array.isArray(items) ? items : [items];
                const bc = arr.find(o => o['@type'] === 'BreadcrumbList');
                if (!bc) continue;
                const list = bc.itemListElement || [];
                const cat    = list.find(i => i.position === 3)?.item?.name || null;
                const subcat = list.find(i => i.position === 4)?.item?.name || null;
                return [cat, subcat];
            } catch {}
        }
        return [null, null];
    }""")
    return tuple(result) if result else (None, None)


# ── Sitemap collection ─────────────────────────────────────────────────────────

def collect_product_urls(page: Page, ctx, cp: dict) -> list[str]:
    """
    Navigate each product sitemap and return all product URLs, excluding
    already-processed ones from the checkpoint.
    """
    all_urls: list[str] = []
    done_set = set(cp["products_done"]) | set(cp["products_skipped"])

    for sitemap_url in SITEMAP_URLS:
        if sitemap_url in cp["sitemaps_done"]:
            logger.info("Sitemap already done: %s", sitemap_url)
            continue

        logger.info("Fetching sitemap: %s", sitemap_url)
        try:
            page.goto(sitemap_url, wait_until="domcontentloaded", timeout=30_000)
        except Exception as exc:
            logger.warning("Could not load sitemap %s: %s", sitemap_url, exc)
            continue

        urls = page.evaluate("""() => {
            const text = document.body.innerText;
            const matches = text.match(/https:\\/\\/store\\.mopar\\.com\\/oem-parts\\/[^\\s<]+/g) || [];
            return [...new Set(matches)];
        }""")

        new_urls = [u for u in urls if u not in done_set]
        all_urls.extend(new_urls)
        logger.info("  %d new product URLs from %s", len(new_urls), sitemap_url)

        cp["sitemaps_done"].append(sitemap_url)
        save_checkpoint(cp)
        limiter.wait(ajax=True)

    return all_urls


# ── DB helpers ─────────────────────────────────────────────────────────────────

def get_or_create(session: Session, model, defaults=None, **kwargs):
    """Fetch an existing record or create it; return (instance, created_bool)."""
    instance = session.query(model).filter_by(**kwargs).first()
    if instance:
        return instance, False
    params = {**kwargs, **(defaults or {})}
    instance = model(**params)
    session.add(instance)
    session.flush()
    return instance, True


def persist_product(session: Session, data: dict, url: str) -> Part | None:
    """
    Write one product (and related entities) to the DB.
    Returns the Part instance, or None if it should be skipped.
    """
    sku = (data.get("sku") or "").strip().upper()
    if not sku:
        return None

    fitment = data.get("fitment") or []
    target_makes_in_fitment = [
        f for f in fitment
        if (f.get("make") or "").lower() in TARGET_MAKES
    ]
    if not target_makes_in_fitment:
        return None

    # ── Manufacturer ─────────────────────────────────────────────────────────
    manufacturer, _ = get_or_create(
        session, Manufacturer,
        name="Mopar",
        defaults={"base_url": BASE_URL},
    )

    # ── Category / SubCategory ────────────────────────────────────────────────
    cat_name = data.get("_category")
    sub_name = data.get("_subcategory")

    category = None
    subcategory = None
    if cat_name:
        category, _ = get_or_create(session, Category, name=cat_name)
    if sub_name and category:
        subcategory, _ = get_or_create(
            session, SubCategory,
            name=sub_name,
            category_id=category.id,
        )

    # ── Part ──────────────────────────────────────────────────────────────────
    # Title: strip " - Mopar (XXXXXXXX)" suffix that the site appends
    raw_title = data.get("title") or ""
    title = re.sub(r"\s*-\s*Mopar\s*\([^)]+\)\s*$", "", raw_title).strip()

    # Strip HTML tags from description
    description = re.sub(r"<[^>]+>", "", data.get("description") or "").strip()

    part, created = get_or_create(session, Part, part_number=sku)
    if created:
        part.url = url
        part.manufacturer_id = manufacturer.id
        part.title = title
        part.category_id = category.id if category else None
        part.other_names = data.get("also_known_as") or None
        part.description = description or None
        part.positions = data.get("positions") or None
        part.notes = data.get("notes") or None
        part.msrp = data.get("msrp") or None
        part.applications = data.get("applications") or None
        part.hazmat = bool(data.get("is_hazmat"))
        session.flush()
    else:
        # Ensure at minimum the URL is set (in case of previous partial run)
        if not part.url:
            part.url = url

    # ── Images ───────────────────────────────────────────────────────────────
    for img_data in data.get("images") or []:
        main = img_data.get("main") or {}
        img_url = main.get("url") or img_data.get("filename")
        if not img_url:
            continue
        # Normalize protocol-relative URLs
        if img_url.startswith("//"):
            img_url = "https:" + img_url

        image, img_created = get_or_create(session, Image, url=img_url)
        if img_created:
            image.name = img_url.rsplit("/", 1)[-1]
            image.alt_text = img_data.get("alt_text") or ""
            image.manufacturer_id = manufacturer.id
            session.flush()

        # Link image to part if not already linked
        existing_link = session.query(PartImages).filter_by(
            part_id=part.id, image_id=image.id
        ).first()
        if not existing_link:
            pi = PartImages(
                part_id=part.id,
                image_id=image.id,
                part_image_text=img_data.get("caption") or None,
            )
            session.add(pi)

    # ── Vehicle fitment (Cars) ────────────────────────────────────────────────
    for fit in target_makes_in_fitment:
        year_name = str(fit.get("year") or "").strip()
        make_name = str(fit.get("make") or "").strip()
        model_name = str(fit.get("model") or "").strip()
        trims = fit.get("trims") or [""]
        engines = fit.get("engines") or [""]

        if not year_name or not make_name or not model_name:
            continue

        year_obj, _ = get_or_create(session, Year, name=year_name)
        make_obj, _ = get_or_create(
            session, Make, name=make_name,
            defaults={"select_value": make_name.lower()},
        )
        model_obj, _ = get_or_create(
            session, Model,
            name=model_name,
            make_id=make_obj.id,
            defaults={"select_value": model_name.lower().replace(" ", "-")},
        )

        for trim_name in trims:
            trim_name = (trim_name or "").strip()
            trim_obj, _ = get_or_create(
                session, Trim, name=trim_name or "Base",
                defaults={"select_value": (trim_name or "base").lower()},
            )

            for engine_name in engines:
                engine_name = (engine_name or "").strip()
                engine_obj, _ = get_or_create(
                    session, Engine, name=engine_name or "Base",
                    defaults={"select_value": (engine_name or "base").lower()},
                )

                # Build a unique vehicle_id slug
                vehicle_id = "-".join([
                    year_name, make_name.lower(),
                    model_name.lower().replace(" ", "-"),
                    trim_name.lower().replace(" ", "-").replace("/", "-"),
                    engine_name.lower().replace(" ", "-").replace(".", "").replace("/", "-"),
                ]).replace("--", "-")

                car, _ = get_or_create(
                    session, Car,
                    vehicle_id=vehicle_id,
                    defaults={
                        "year_id": year_obj.id,
                        "make_id": make_obj.id,
                        "model_id": model_obj.id,
                        "trim_id": trim_obj.id,
                        "engine_id": engine_obj.id,
                        "manufacturer_id": manufacturer.id,
                        "car_id": vehicle_id,
                        "base_url": f"{BASE_URL}/v-{vehicle_id}",
                    },
                )

                # Link car to part
                if part not in car.parts:
                    car.parts.append(part)

    session.commit()
    return part


# ── Main scrape loop ───────────────────────────────────────────────────────────

def scrape_products(
    page: Page,
    ctx,
    session: Session,
    product_urls: list[str],
    cp: dict,
    out,
) -> int:
    total_saved = 0
    done_set = set(cp["products_done"])
    skipped_set = set(cp["products_skipped"])

    for i, url in enumerate(product_urls):
        if url in done_set or url in skipped_set:
            continue

        logger.info("[%d/%d] %s", i + 1, len(product_urls), url)

        try:
            fetch_page(url, page, ctx)
            dismiss_overlays(page)

            data = parse_inline_json(page)
            if not data:
                logger.warning("No in_rp_catalog JSON found: %s", url)
                cp["products_skipped"].append(url)
                save_checkpoint(cp)
                continue

            cat_name, sub_name = parse_breadcrumb(page)
            data["_category"] = cat_name
            data["_subcategory"] = sub_name

            part = persist_product(session, data, url)
            if part is None:
                logger.debug("Skipped (no target make): %s", url)
                cp["products_skipped"].append(url)
            else:
                record = make_record(
                    DOMAIN, url,
                    part_number=part.part_number,
                    title=part.title,
                    msrp=part.msrp,
                    category=cat_name,
                    subcategory=sub_name,
                )
                write_record(record, out)
                cp["products_done"].append(url)
                total_saved += 1
                logger.info("  Saved: %s — %s", part.part_number, part.title)

            save_checkpoint(cp)

        except SystemExit:
            raise
        except PWTimeout:
            logger.warning("Playwright timeout on %s — skipping", url)
            cp["products_skipped"].append(url)
            save_checkpoint(cp)
        except Exception as exc:
            logger.error("Error processing %s: %s", url, exc)
            cp["products_skipped"].append(url)
            save_checkpoint(cp)

    return total_saved


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    limiter.check()

    engine = init_db(str(DB_PATH))
    cp = load_checkpoint()

    logger.info("DB: %s", DB_PATH)
    logger.info("Checkpoint: %s done, %s skipped",
                len(cp["products_done"]), len(cp["products_skipped"]))

    with build_context("mopar_parts", with_images=False) as ctx:
        with open(JSONL_FILE, "a", encoding="utf-8") as out:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0.0.0 Safari/537.36"
                    ),
                    viewport={"width": 1280, "height": 900},
                    locale="en-US",
                )

                # Intercept 429s at the network level
                def on_response(response):
                    if response.status == 429:
                        limiter.ban(response.headers.get("retry-after"))

                context.on("response", on_response)
                page = context.new_page()

                try:
                    # Phase 1: collect all product URLs from sitemaps
                    logger.info("=== Phase 1: Collecting product URLs from sitemaps ===")
                    product_urls = collect_product_urls(page, ctx, cp)
                    logger.info("Total new product URLs to scrape: %d", len(product_urls))

                    # Phase 2: scrape each product page
                    logger.info("=== Phase 2: Scraping product pages ===")
                    with Session(engine) as session:
                        total = scrape_products(page, ctx, session, product_urls, cp, out)

                finally:
                    browser.close()

    logger.info("Done. Saved %d parts to %s", total if "total" in dir() else 0, DB_PATH)


if __name__ == "__main__":
    main()
