import os

# ── Source site ───────────────────────────────────────────────────────────────
BASE_URL       = "https://www.suzukipartshouse.com"
ROOT_PARTS_URL = f"{BASE_URL}/oemparts/c/suzuki_motorcycle/parts"
SITE_DOMAIN    = "www.suzukipartshouse.com"
# Diagram images live on Babbitt's media CDN, not the Cloudflare-gated site.
MEDIA_DOMAIN = "media.vxt.production.ldv-svcs.live"

# ── Scrape stack ──────────────────────────────────────────────────────────────
WEBCACHE_URL            = os.environ.get("WEBCACHE_URL", "http://localhost:8000")
IMGCACHE_URL            = os.environ.get("IMGCACHE_URL", "http://localhost:8010")
REQUEST_AUTH_SERVER_URL = os.environ.get("REQUEST_AUTH_SERVER_URL", "localhost:9000")
CACHE_CLIENT_NAME       = "suzuki_scraper"
CACHE_BUCKET            = os.environ.get("CACHE_BUCKET", "default")

# ── HTTP headers ──────────────────────────────────────────────────────────────
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# ── Browser settings ──────────────────────────────────────────────────────────
PAGE_TIMEOUT_MS       = 60_000   # page.goto()
CHALLENGE_WAIT_MS     = 60_000   # max time for one Cloudflare challenge to clear
CHALLENGE_POLL_MS     = 2_000

# ── Retry settings for failed requests ───────────────────────────────────────
# Rate limiting against the site is handled by request-auth (permits — the
# domain is paced at 1 req/30s there, well above the old robots.txt
# Crawl-delay: 10); these retries only cover transient transport failures.
MAX_RETRIES           = 3
RETRY_BACKOFF_SECONDS = 30.0
