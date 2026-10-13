import os

# ── Source: Yamaha Motor parts catalogue ──────────────────────────────────────
# Two hosts:
#   api.yamaha-motor.com        — anonymous auth + legacy browse API (Bearer JWT)
#   yamaha-motor.com            — Next.js site; _next/data JSON endpoints
BASE_URL      = "https://yamaha-motor.com"
PARTS_PAGE_URL = f"{BASE_URL}/parts/motorcycle"
AUTH_URL      = "https://api.yamaha-motor.com/auth"
API_BASE      = "https://api.yamaha-motor.com/legacy/api/v1.0.0"
API_DOMAIN    = "api.yamaha-motor.com"
SITE_DOMAIN   = "yamaha-motor.com"

# ── Scrape stack ──────────────────────────────────────────────────────────────
WEBCACHE_URL            = os.environ.get("WEBCACHE_URL", "http://localhost:8000")
IMGCACHE_URL            = os.environ.get("IMGCACHE_URL", "http://localhost:8010")
REQUEST_AUTH_SERVER_URL = os.environ.get("REQUEST_AUTH_SERVER_URL", "localhost:9000")
CACHE_CLIENT_NAME       = "yamaha_scraper"
CACHE_BUCKET            = os.environ.get("CACHE_BUCKET", "default")

# ── HTTP headers ──────────────────────────────────────────────────────────────
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

PAGE_HEADERS = {
    "User-Agent":      USER_AGENT,
    "Accept":          "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":          PARTS_PAGE_URL,
}

# ── Retry settings for failed requests ───────────────────────────────────────
# Rate limiting against the site is handled by request-auth (permits); these
# retries only cover transient transport failures.
MAX_RETRIES           = 3
RETRY_BACKOFF_SECONDS = 10.0
