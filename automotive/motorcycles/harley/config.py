import os

# ── Source: ARI PartStream JSONP API (powers harley-davidson.com service parts)
ARI_API_KEY = "XAqgHmSGi2VuKMInUYbD"
ARI_BRAND   = "HDM"
ARI_BASE_URL     = "https://partstream.arinet.com"
ARI_IMAGE_DOMAIN = "cdn.datamanager.arinet.com"
ARI_PAGE_URL     = "https://www.harley-davidson.com/us/en/shop/c/motorcycle-service-parts?aribrand=HDM"
SITE_DOMAIN      = "partstream.arinet.com"

# ── Scrape stack ──────────────────────────────────────────────────────────────
WEBCACHE_URL            = os.environ.get("WEBCACHE_URL", "http://localhost:8000")
IMGCACHE_URL            = os.environ.get("IMGCACHE_URL", "http://localhost:8010")
REQUEST_AUTH_SERVER_URL = os.environ.get("REQUEST_AUTH_SERVER_URL", "localhost:9000")
CACHE_CLIENT_NAME       = "harley_scraper"
CACHE_BUCKET            = os.environ.get("CACHE_BUCKET", "default")

# ── HTTP headers ──────────────────────────────────────────────────────────────
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

PAGE_HEADERS = {
    "User-Agent":      USER_AGENT,
    "Accept":          "text/javascript, application/javascript, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":          "https://www.harley-davidson.com/",
}

# ── Retry settings for failed requests ───────────────────────────────────────
# Rate limiting against the API is handled by request-auth (permits); these
# retries only cover transient transport failures.
MAX_RETRIES           = 3
RETRY_BACKOFF_SECONDS = 10.0
