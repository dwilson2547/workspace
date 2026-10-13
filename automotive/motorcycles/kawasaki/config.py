import os

# ── Source site ───────────────────────────────────────────────────────────────
BASE_URL            = "https://www.kawasaki.com"
MAIN_PAGE_URL       = f"{BASE_URL}/en-us/owner-center/parts"
AJAX_YEARS_URL      = f"{BASE_URL}/en-us/ownercenter/PartsAjaxModelYears"
AJAX_PRODUCTS_URL   = f"{BASE_URL}/en-us/ownercenter/PartsAjaxProducts"
SITE_DOMAIN          = "www.kawasaki.com"

# Maps ProductCategoryId → human-readable vehicle category name.
# Categories 5+ appear in the UI but currently have no parts-diagram data.
CATEGORIES: dict[int, str] = {
    1: "Motorcycle",
    2: "ATV",
    3: "Side x Side",
    4: "Watercraft",
}

# ── Scrape stack ──────────────────────────────────────────────────────────────
WEBCACHE_URL            = os.environ.get("WEBCACHE_URL", "http://localhost:8000")
IMGCACHE_URL            = os.environ.get("IMGCACHE_URL", "http://localhost:8010")
REQUEST_AUTH_SERVER_URL = os.environ.get("REQUEST_AUTH_SERVER_URL", "localhost:9000")
CACHE_CLIENT_NAME       = "kawasaki_scraper"
CACHE_BUCKET            = os.environ.get("CACHE_BUCKET", "default")

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

# ── Retry settings for failed requests ───────────────────────────────────────
# Rate limiting against the site is handled by request-auth (permits); these
# retries only cover transient transport failures.
MAX_RETRIES           = 3
RETRY_BACKOFF_SECONDS = 10.0

# ── Session refresh interval (seconds) ───────────────────────────────────────
# Re-establish the ASPSESID cookie roughly every 30 minutes to prevent expiry.
SESSION_REFRESH_INTERVAL = 1800
