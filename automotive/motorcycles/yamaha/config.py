from pathlib import Path

BASE_DIR = Path(__file__).parent
PART_DATA_DIR = BASE_DIR / "part_data"
IMAGES_DIR = PART_DATA_DIR / "images"
CACHE_DIR = PART_DATA_DIR / "cache"
DB_PATH = PART_DATA_DIR / "yamaha_parts.db"

BASE_URL = "https://yamaha-motor.com"
API_BASE = "https://yamaha-api-poc-main.prod.yamaha-motor.com/v1.0.0"
PARTS_MOTORCYCLE_URL = f"{BASE_URL}/parts/motorcycle"

DELAY_MIN_SECONDS = 2.0
DELAY_MAX_SECONDS = 5.0

MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 30.0

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
