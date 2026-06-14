#!/usr/bin/env python3
# diagram_scraper.py — Phase 3: scrape exploded-view diagrams from store.mopar.com
#
# Run AFTER scraper.py has populated Part and Car records.
#
# URL pattern:
#   Vehicle page  : /v-{year}-{make}-{model}
#   Group page    : /v-{vehicle-slug}/{engine-group-slug}--{subcategory-slug}
#   Assembly page : {group-url}?assembly={N}   (1-indexed)
#
# Data extracted from assembly pages:
#   - Diagram image URL:    img[alt*=" #0"]  (first assembly has alt "… #0")
#   - Category/subcategory: JSON-LD BreadcrumbList (same as product pages)
#   - Callout → part:       DOM elements with id="part_row_0_{callout}_{?}"
#                           Part number from /oem-parts/…-{PARTNUM} URL slug

import json
import logging
import re
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, TimeoutError as PWTimeout
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from bot_scraper_lib import build_context, RateLimiter
from models import (
    Base, Car, Category, Diagram, DiagramParts, Engine, Image, Make,
    Model, Part, SubCategory, Year, car_diagrams, init_db,
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
CHECKPOINT_FILE = Path(__file__).parent / "diagram_checkpoint.json"

limiter = RateLimiter(DOMAIN, page_delay=(1.5, 2.5), ajax_delay=(0.5, 1.0))

# ── Slug helpers ───────────────────────────────────────────────────────────────

def _slug(s: str) -> str:
    """Convert a display name to a URL slug the way Mopar does it."""
    s = s.lower()
    s = re.sub(r"\.", "-", s)         # period → hyphen  ("3.7L" → "3-7l")
    s = re.sub(r"[^a-z0-9]+", "-", s) # any non-alnum run → single hyphen
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def vehicle_slug(year: str, make: str, model: str, trim: str = "", engine: str = "") -> str:
    """
    Build the full Mopar vehicle URL slug:
        year-make-model[--trim][--engine]
    Double hyphens separate the year-make-model block from trim and engine.
    """
    ym = f"{year}-{_slug(make)}-{_slug(model)}"
    parts = [ym]
    if trim and trim.lower() not in ("", "base"):
        parts.append(_slug(trim))
    if engine and engine.lower() not in ("", "base"):
        parts.append(_slug(engine))
    return "--".join(parts)


# ── Checkpoint ─────────────────────────────────────────────────────────────────

def load_cp() -> dict:
    if CHECKPOINT_FILE.exists():
        return json.loads(CHECKPOINT_FILE.read_text())
    return {"vehicles_done": [], "groups_done": []}


def save_cp(cp: dict) -> None:
    CHECKPOINT_FILE.write_text(json.dumps(cp, indent=2))


# ── Playwright helpers ─────────────────────────────────────────────────────────

_OVERLAY_JS = """() => {
    document.querySelectorAll(
        '.modal, .modal-backdrop, #ig_modal, #creditCardPromoModal, #cm-popup-overlay'
    ).forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
}"""


def _goto(page: Page, url: str, ctx) -> bool:
    """Navigate, check webcache, remove overlays. Returns True on success."""
    entry = ctx.web_cache.get(url)
    if entry:
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        except PWTimeout:
            pass
        page.evaluate(_OVERLAY_JS)
        return True
    try:
        page.goto(url, wait_until="networkidle", timeout=35_000)
    except PWTimeout:
        logger.warning("Timeout loading %s", url)
        return False
    page.evaluate(_OVERLAY_JS)
    html = page.content()
    ctx.web_cache.store(url, html, ctx.client_name)
    limiter.wait()
    return True


# ── Sitemap / vehicle discovery ────────────────────────────────────────────────

def unique_vehicles(session: Session) -> list[tuple[str, str, str, str, str]]:
    """
    Return one representative (year, make, model, trim, engine) per
    unique (year, make, model) combination from the Car table.
    Any one trim+engine is sufficient to navigate the sidebar (it shows all).
    """
    from models import Trim, Engine as EngineModel
    # Use MIN(car.id) as the representative
    subq = (
        select(Car.id)
        .join(Year, Car.year_id == Year.id)
        .join(Make, Car.make_id == Make.id)
        .join(Model, Car.model_id == Model.id)
        .group_by(Year.name, Make.name, Model.name)
    ).subquery()
    rows = session.execute(
        select(Year.name, Make.name, Model.name, Trim.name, EngineModel.name)
        .join(Car, Car.year_id == Year.id)
        .join(Make, Car.make_id == Make.id)
        .join(Model, Car.model_id == Model.id)
        .join(Trim, Car.trim_id == Trim.id)
        .join(EngineModel, Car.engine_id == EngineModel.id)
        .where(Car.id.in_(subq))
        .order_by(Year.name, Make.name, Model.name)
    ).all()
    return [(r[0], r[1], r[2], r[3], r[4]) for r in rows]


# ── Group URL collection ───────────────────────────────────────────────────────

def get_group_urls(page: Page, vslug: str, ctx) -> list[str]:
    """
    Navigate /v-{vslug} and return all assembly-group URLs from the sidebar.
    The sidebar uses accordion links; group URLs are anchored under them and
    may already be in the DOM (hidden) or require expanding.
    """
    vehicle_url = f"{BASE_URL}/v-{vslug}"
    if not _goto(page, vehicle_url, ctx):
        return []

    # Group links use the full vehicle slug as their prefix (same as the URL we navigated to)
    prefix = f"/v-{vslug}/"
    urls: list[str] = page.evaluate("""(prefix) => {
        return [...new Set(
            Array.from(document.querySelectorAll('a[href]'))
                .map(a => { try { return new URL(a.href); } catch { return null; } })
                .filter(u => u && u.pathname.startsWith(prefix) && !u.search)
                .map(u => u.href)
        )];
    }""", prefix)

    if not urls:
        # Expand all accordion sections by clicking their headers, then re-query
        logger.debug("Expanding sidebar accordions for %s", vehicle_url)
        page.evaluate("""() => {
            document.querySelectorAll('a[href^="#cat-"]').forEach(a => a.click());
        }""")
        page.wait_for_timeout(1500)
        urls = page.evaluate("""(prefix) => {
            return [...new Set(
                Array.from(document.querySelectorAll('a[href]'))
                    .map(a => { try { return new URL(a.href); } catch { return null; } })
                    .filter(u => u && u.pathname.startsWith(prefix) && !u.search)
                    .map(u => u.href)
            )];
        }""", prefix)

    limiter.wait(ajax=True)
    return urls


# ── Assembly count ─────────────────────────────────────────────────────────────

def get_assembly_urls(page: Page, group_url: str, ctx) -> list[str]:
    """Return all ?assembly=N URLs visible on the group page thumbnail row."""
    if not _goto(page, group_url, ctx):
        return []

    urls: list[str] = page.evaluate("""() => {
        return [...new Set(
            Array.from(document.querySelectorAll('a[href*="assembly="]'))
                .map(a => a.href)
        )];
    }""")

    limiter.wait(ajax=True)
    # Ensure they're sorted by assembly number
    urls.sort(key=lambda u: int(re.search(r"assembly=(\d+)", u).group(1)))
    return urls or [group_url + "?assembly=1"]


# ── Assembly page parsing ──────────────────────────────────────────────────────

def parse_assembly_page(page: Page) -> dict | None:
    """Extract diagram image URL, breadcrumb, and callout→part mappings."""
    return page.evaluate("""() => {
        // Active diagram image (alt ends with " #0" when assembly param=1, etc.)
        const diagImg = document.querySelector('img[alt*=" #"]');
        if (!diagImg) return null;
        const imgSrc = diagImg.src;
        if (!imgSrc || !imgSrc.includes('cdn-illustrations')) return null;

        // Page title
        const h1 = document.querySelector('h1');
        const title = h1 ? h1.textContent.trim() : null;

        // BreadcrumbList for category.
        // On diagram pages the breadcrumb is:
        //   1=Home, 2=Vehicle, 3=Trim/Engine variant, 4=Parts group (e.g. "Engine Mounting")
        // We want position 4 as the category; position 3 is vehicle context, not a parts category.
        let category = null, subcategory = null;
        for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
            try {
                const list = JSON.parse(s.textContent.trim());
                const arr = Array.isArray(list) ? list : [list];
                const bc = arr.find(o => o['@type'] === 'BreadcrumbList');
                if (!bc) continue;
                const items = bc.itemListElement || [];
                category = items.find(i => i.position === 4)?.item?.name || null;
                // position 5 may exist for deeper nesting
                subcategory = items.find(i => i.position === 5)?.item?.name || null;
                break;
            } catch {}
        }

        // Callout → part rows: id format is "part_row_0_{callout}_{?}"
        // (the "0" is the 0-indexed assembly position within the page DOM)
        const partRows = Array.from(document.querySelectorAll('[id^="part_row_0_"]')).map(row => {
            const callout = row.id.split('_')[3];
            const link = row.querySelector('a[href*="/oem-parts/"]');
            if (!link) return null;
            // Extract part number: last hyphen-separated token in the URL slug
            const slug = link.href.split('/').pop();
            const m = slug.match(/-([A-Za-z0-9]+)$/);
            const partNumber = m ? m[1].toUpperCase() : null;
            return { callout, partNumber, url: link.href };
        }).filter(Boolean);

        return { imgSrc, title, category, subcategory, partRows };
    }""")


# ── DB persistence ─────────────────────────────────────────────────────────────

def get_or_create_cat(session: Session, name: str) -> Category | None:
    if not name:
        return None
    obj = session.query(Category).filter_by(name=name).first()
    if not obj:
        obj = Category(name=name)
        session.add(obj)
        session.flush()
    return obj


def get_or_create_subcat(session: Session, name: str, cat: Category | None) -> SubCategory | None:
    if not name or not cat:
        return None
    obj = session.query(SubCategory).filter_by(name=name, category_id=cat.id).first()
    if not obj:
        obj = SubCategory(name=name, category_id=cat.id)
        session.add(obj)
        session.flush()
    return obj


def persist_diagram(
    session: Session,
    data: dict,
    asm_url: str,
    base_car_url: str,
) -> Diagram | None:
    """Create or retrieve Diagram + DiagramParts for one assembly page."""

    img_url = data["imgSrc"]

    # Reuse existing diagram for this exact assembly URL
    existing = session.query(Diagram).filter_by(category_url=asm_url).first()
    if existing:
        return existing

    # Image record (store the illustration URL; imgcache downloads later)
    img = session.query(Image).filter_by(url=img_url).first()
    if not img:
        img = Image(
            url=img_url,
            name=img_url.rsplit("/", 1)[-1],
            alt_text=data.get("title") or "",
        )
        session.add(img)
        session.flush()

    cat = get_or_create_cat(session, data.get("category"))
    subcat = get_or_create_subcat(session, data.get("subcategory"), cat)

    diagram = Diagram(
        image_id=img.id,
        category_id=cat.id if cat else None,
        sub_category_id=subcat.id if subcat else None,
        base_car_url=base_car_url,
        category_url=asm_url,
    )
    session.add(diagram)
    session.flush()

    # DiagramParts: callout → Part
    for row in data.get("partRows") or []:
        part = session.query(Part).filter_by(part_number=row["partNumber"]).first()
        if not part:
            continue
        # DiagramParts has composite PK (diagram_id, part_id) — use upsert
        stmt = sqlite_insert(DiagramParts.__table__).values(
            diagram_id=diagram.id,
            part_id=part.id,
            part_index=row["callout"],
        ).on_conflict_do_nothing()
        session.execute(stmt)

    session.commit()
    return diagram


def link_cars_to_diagram(
    session: Session,
    diagram: Diagram,
    year_name: str,
    make_name: str,
    model_name: str,
) -> int:
    """Insert car_diagrams rows for all Cars with the given year+make+model."""
    cars = session.execute(
        select(Car)
        .join(Year, Car.year_id == Year.id)
        .join(Make, Car.make_id == Make.id)
        .join(Model, Car.model_id == Model.id)
        .where(Year.name == year_name)
        .where(Make.name == make_name)
        .where(Model.name == model_name)
    ).scalars().all()

    count = 0
    for car in cars:
        stmt = sqlite_insert(car_diagrams).values(
            car_id=car.id,
            diagram_id=diagram.id,
        ).on_conflict_do_nothing()
        session.execute(stmt)
        count += 1
    session.commit()
    return count


# ── Main scrape loop ───────────────────────────────────────────────────────────

def scrape_diagrams(session: Session, page: Page, ctx) -> None:
    cp = load_cp()
    done_vehicles = set(cp["vehicles_done"])
    done_groups = set(cp["groups_done"])

    vehicles = unique_vehicles(session)
    logger.info("Found %d unique year+make+model combinations in DB", len(vehicles))

    for year_name, make_name, model_name, trim_name, engine_name in vehicles:
        vslug = vehicle_slug(year_name, make_name, model_name, trim_name, engine_name)
        # base_car_url stored on Diagram uses the model-level URL (trimless)
        base_car_url = f"{BASE_URL}/v-{vehicle_slug(year_name, make_name, model_name)}"

        # Dedup key is the year-make-model portion (trim/engine just pick one URL to navigate)
        vkey = vehicle_slug(year_name, make_name, model_name)
        if vkey in done_vehicles:
            logger.debug("Skip (done): %s", vkey)
            continue

        logger.info("Vehicle: %s", vslug)
        group_urls = get_group_urls(page, vslug, ctx)
        logger.info("  %d group pages found", len(group_urls))

        for group_url in group_urls:
            if group_url in done_groups:
                continue

            asm_urls = get_assembly_urls(page, group_url, ctx)
            diagrams_saved = 0

            for asm_url in asm_urls:
                logger.debug("    Assembly: %s", asm_url)
                try:
                    ok = _goto(page, asm_url, ctx)
                    if not ok:
                        continue

                    data = parse_assembly_page(page)
                    if not data:
                        logger.debug("    No diagram data on %s", asm_url)
                        continue

                    diagram = persist_diagram(session, data, asm_url, base_car_url)
                    if diagram:
                        linked = link_cars_to_diagram(
                            session, diagram, year_name, make_name, model_name
                        )
                        diagrams_saved += 1
                        logger.info(
                            "    Saved diagram: %s (%d parts, linked to %d cars)",
                            diagram.category_url,
                            len(data.get("partRows") or []),
                            linked,
                        )

                except SystemExit:
                    raise
                except PWTimeout:
                    logger.warning("    Timeout on %s — skipping", asm_url)
                except Exception as exc:
                    logger.error("    Error on %s: %s", asm_url, exc)

            done_groups.add(group_url)
            cp["groups_done"] = list(done_groups)
            save_cp(cp)
            logger.info("  Group done: %s (%d diagrams)", group_url, diagrams_saved)

        done_vehicles.add(vkey)
        cp["vehicles_done"] = list(done_vehicles)
        save_cp(cp)

    logger.info("Diagram scraping complete.")


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    limiter.check()
    engine = init_db(str(DB_PATH))

    logger.info("DB: %s", DB_PATH)

    with build_context("mopar_diagrams", with_images=False) as ctx:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            bctx = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
                locale="en-US",
            )

            def on_response(resp):
                if resp.status == 429:
                    limiter.ban(resp.headers.get("retry-after"))

            bctx.on("response", on_response)
            page = bctx.new_page()

            try:
                with Session(engine) as session:
                    scrape_diagrams(session, page, ctx)
            finally:
                browser.close()


if __name__ == "__main__":
    main()
