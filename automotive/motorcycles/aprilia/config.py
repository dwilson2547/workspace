from pathlib import Path

# ── Directories ───────────────────────────────────────────────────────────────
BASE_DIR      = Path(__file__).parent
PART_DATA_DIR = BASE_DIR / "part_data"
IMAGES_DIR    = PART_DATA_DIR / "images"

# ── Database ──────────────────────────────────────────────────────────────────
DB_PATH = PART_DATA_DIR / "aprilia_parts.db"

# ── Source site ───────────────────────────────────────────────────────────────
BASE_URL      = "https://aprilia.genuine-parts-catalogue.com"
# The main motorcycle page lists ALL vehicle types + displacements in one page
MAIN_PAGE_URL = f"{BASE_URL}/aprilia-motorcycle"

# Maps the trailing segment of a displacement slug → human-readable vehicle type.
# e.g. "50-APRILIA-MOTORCYCLES" ends with "MOTORCYCLES" → "Motorcycle"
DISPLACEMENT_TYPE_MAP: dict[str, str] = {
    "MOTORCYCLES": "Motorcycle",
    "SCOOTER":     "Scooter",
    "QUAD":        "QUAD-ATV",
    "BICYCLE":     "Electric",
}

# ── WebCache ──────────────────────────────────────────────────────────────────
WEBCACHE_URL       = "http://localhost:8000"
CACHE_CLIENT_NAME  = "aprilia_scraper"

# ── Playwright pacing — intentionally slow to avoid IP bans ──────────────────
DELAY_MIN_SECONDS    = 2.5
DELAY_MAX_SECONDS    = 5.5

# ── Retry settings for failed page fetches ───────────────────────────────────
MAX_RETRIES           = 3
RETRY_BACKOFF_SECONDS = 30.0

# ── HTTP headers for image downloads ─────────────────────────────────────────
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
