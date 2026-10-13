import os

# ── Source site ───────────────────────────────────────────────────────────────
BASE_URL      = "https://aprilia.genuine-parts-catalogue.com"
MAIN_PAGE_URL = f"{BASE_URL}/aprilia-motorcycle"
SITE_DOMAIN   = "aprilia.genuine-parts-catalogue.com"

# Maps the trailing segment of a displacement slug → human-readable vehicle type.
# e.g. "50-APRILIA-MOTORCYCLES" ends with "MOTORCYCLES" → "Motorcycle"
DISPLACEMENT_TYPE_MAP: dict[str, str] = {
    "MOTORCYCLES": "Motorcycle",
    "SCOOTER":     "Scooter",
    "QUAD":        "QUAD-ATV",
    "BICYCLE":     "Electric",
}

# ── Scrape stack ──────────────────────────────────────────────────────────────
WEBCACHE_URL            = os.environ.get("WEBCACHE_URL", "http://localhost:8000")
IMGCACHE_URL            = os.environ.get("IMGCACHE_URL", "http://localhost:8010")
REQUEST_AUTH_SERVER_URL = os.environ.get("REQUEST_AUTH_SERVER_URL", "localhost:9000")
CACHE_CLIENT_NAME       = "aprilia_scraper"
CACHE_BUCKET            = os.environ.get("CACHE_BUCKET", "default")

# ── HTTP headers ──────────────────────────────────────────────────────────────
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

PAGE_HEADERS = {
    "User-Agent":       USER_AGENT,
    "Accept":           "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language":  "en-GB,en;q=0.9",
    "Referer":           MAIN_PAGE_URL,
}

# ── Retry settings for failed requests ───────────────────────────────────────
# Rate limiting against the site is handled by request-auth (permits); these
# retries only cover transient transport failures.
MAX_RETRIES           = 3
RETRY_BACKOFF_SECONDS = 10.0
