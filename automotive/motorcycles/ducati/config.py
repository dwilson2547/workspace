import os

# ── Source ────────────────────────────────────────────────────────────────────
# Ducati Omaha republishes Ducati's OEM parts catalogues on Issuu. The index
# page lists every catalogue; each document's pages are rendered as SVGs.
SOURCE_URL       = "https://www.ducatiomaha.com/pages/ducati-oem-parts"
ISSUU_USER       = "ducatiomaha"
INDEX_DOMAIN     = "www.ducatiomaha.com"
READER_BASE      = f"https://reader3.isu.pub/{ISSUU_USER}"
READER_DOMAIN    = "reader3.isu.pub"
SVG_DOMAIN       = "svg.issuu.com"
ISSUU_DOC_URL    = f"https://issuu.com/{ISSUU_USER}/docs"   # human-readable

# ── Scrape stack ──────────────────────────────────────────────────────────────
WEBCACHE_URL            = os.environ.get("WEBCACHE_URL", "http://localhost:8000")
IMGCACHE_URL            = os.environ.get("IMGCACHE_URL", "http://localhost:8010")
REQUEST_AUTH_SERVER_URL = os.environ.get("REQUEST_AUTH_SERVER_URL", "localhost:9000")
CACHE_CLIENT_NAME       = "ducati_scraper"
CACHE_BUCKET            = os.environ.get("CACHE_BUCKET", "default")

# ── HTTP headers ──────────────────────────────────────────────────────────────
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

PAGE_HEADERS = {
    "User-Agent":      USER_AGENT,
    "Accept":          "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":          "https://www.ducatiomaha.com/",
}

# ── Retry settings for failed requests ───────────────────────────────────────
# Rate limiting against the hosts is handled by request-auth (permits); these
# retries only cover transient transport failures.
MAX_RETRIES           = 3
RETRY_BACKOFF_SECONDS = 10.0

# Catalogues whose reader4.json is younger than this (days) are skipped —
# unchanged documents don't need re-parsing.
READER_JSON_MAX_AGE_DAYS = 30
