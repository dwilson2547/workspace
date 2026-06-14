import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PART_DATA_DIR = BASE_DIR / "part_data"
IMAGES_DIR = PART_DATA_DIR / "images"
DB_PATH = PART_DATA_DIR / "harley_parts.db"

# Bootstrap webcache and imgcache client paths
_WEBCACHE_CLIENT_DIR = BASE_DIR.parent.parent.parent / "webcache" / "client"
_IMGCACHE_CLIENT_DIR = BASE_DIR.parent.parent.parent / "imgcache" / "client"
sys.path.insert(0, str(_WEBCACHE_CLIENT_DIR))
sys.path.insert(0, str(_IMGCACHE_CLIENT_DIR))

# ARI PartStream API
ARI_API_KEY = "XAqgHmSGi2VuKMInUYbD"
ARI_BRAND = "HDM"
ARI_BASE_URL = "https://partstream.arinet.com"
ARI_PAGE_URL = "https://www.harley-davidson.com/us/en/shop/c/motorcycle-service-parts?aribrand=HDM"

# Cache service URLs
WEBCACHE_URL = "http://localhost:8000"
IMGCACHE_URL = "http://localhost:8010"
CACHE_CLIENT_NAME = "harley_parts_scraper"
DOMAIN = "partstream.arinet.com"

# Rate limiting
DELAY_MIN = 0.5
DELAY_MAX = 1.0

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

BACKOFF_FILE = BASE_DIR / "backoff.json"

PART_DATA_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
