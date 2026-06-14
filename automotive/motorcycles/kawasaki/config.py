from pathlib import Path

# ── Directories ───────────────────────────────────────────────────────────────
BASE_DIR      = Path(__file__).parent
PART_DATA_DIR = BASE_DIR / "part_data"
IMAGES_DIR    = PART_DATA_DIR / "images"

# ── Database ──────────────────────────────────────────────────────────────────
DB_PATH = PART_DATA_DIR / "kawasaki_parts.db"

# ── Source site ───────────────────────────────────────────────────────────────
BASE_URL            = "https://www.kawasaki.com"
MAIN_PAGE_URL       = f"{BASE_URL}/en-us/owner-center/parts"
AJAX_YEARS_URL      = f"{BASE_URL}/en-us/ownercenter/PartsAjaxModelYears"
AJAX_PRODUCTS_URL   = f"{BASE_URL}/en-us/ownercenter/PartsAjaxProducts"

# Maps ProductCategoryId → human-readable vehicle category name.
# Categories 5+ appear in the UI but currently have no parts-diagram data.
CATEGORIES: dict[int, str] = {
    1: "Motorcycle",
    2: "ATV",
    3: "Side x Side",
    4: "Watercraft",
}

# ── WebCache ──────────────────────────────────────────────────────────────────
WEBCACHE_URL      = "http://localhost:8000"
CACHE_CLIENT_NAME = "kawasaki_scraper"
CACHE_BUCKET      = "default"

# ── HTTP headers ──────────────────────────────────────────────────────────────
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

AJAX_HEADERS = {
    "User-Agent":        USER_AGENT,
    "X-Requested-With":  "XMLHttpRequest",
    "Content-Type":      "application/x-www-form-urlencoded; charset=UTF-8",
    "Referer":           MAIN_PAGE_URL,
    "Accept":            "*/*",
}

PAGE_HEADERS = {
    "User-Agent":       USER_AGENT,
    "Accept":           "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language":  "en-US,en;q=0.9",
    "Referer":          MAIN_PAGE_URL,
}

# ── Pacing — intentionally slow to avoid IP bans ─────────────────────────────
DELAY_MIN_SECONDS    = 2.0
DELAY_MAX_SECONDS    = 5.0

# ── Retry settings for failed requests ───────────────────────────────────────
MAX_RETRIES           = 3
RETRY_BACKOFF_SECONDS = 30.0

# ── Session refresh interval (seconds) ───────────────────────────────────────
# Re-establish the ASPSESID cookie roughly every 30 minutes to prevent expiry.
SESSION_REFRESH_INTERVAL = 1800
