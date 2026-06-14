from pathlib import Path

# Directories
BASE_DIR = Path(__file__).parent
CATALOGS_DIR = BASE_DIR / "part_catalogs"

# SQLite database file (created automatically on first run)
DB_PATH = BASE_DIR / "ducati_parts.db"

# Source page
SOURCE_URL = "https://www.ducatiomaha.com/pages/ducati-oem-parts"

# How many days before we re-download the same catalog
REDOWNLOAD_THRESHOLD_DAYS = 30

# Playwright: random jitter window (seconds) between Issuu page loads.
# A random value in [DELAY_MIN, DELAY_MAX] is chosen for each request so
# the timing pattern doesn't look mechanical to Cloudflare.
DELAY_MIN_SECONDS = 4.0
DELAY_MAX_SECONDS = 9.0

# Retry settings for failed downloads (exponential back-off with jitter)
DOWNLOAD_MAX_RETRIES = 3
DOWNLOAD_BACKOFF_BASE_SECONDS = 15.0  # base wait; doubles each attempt
