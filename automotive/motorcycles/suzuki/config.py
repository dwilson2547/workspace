import json
from pathlib import Path
from datetime import datetime, timezone

# ── Directories ───────────────────────────────────────────────────────────────
BASE_DIR      = Path(__file__).parent
PART_DATA_DIR = BASE_DIR / "part_data"
IMAGES_DIR    = PART_DATA_DIR / "images"  # local fallback for image metadata

# ── Database ──────────────────────────────────────────────────────────────────
DB_PATH = PART_DATA_DIR / "suzuki_parts.db"

# ── Source site ───────────────────────────────────────────────────────────────
BASE_URL        = "https://www.suzukipartshouse.com"
ROOT_PARTS_URL  = f"{BASE_URL}/oemparts/c/suzuki_motorcycle/parts"
DOMAIN          = "www.suzukipartshouse.com"

# ── Cache services ────────────────────────────────────────────────────────────
WEBCACHE_URL      = "http://localhost:8000"
IMGCACHE_URL      = "http://localhost:8010"
CACHE_CLIENT_NAME = "suzuki_parts"

# ── HTTP / browser ────────────────────────────────────────────────────────────
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# ── Pacing ────────────────────────────────────────────────────────────────────
# robots.txt specifies Crawl-delay: 10.  README asks for 30s minimum.
DELAY_MIN_SECONDS    = 30.0
DELAY_MAX_SECONDS    = 45.0

# ── Retry settings ────────────────────────────────────────────────────────────
MAX_RETRIES           = 3
RETRY_BACKOFF_SECONDS = 60.0

# ── Playwright timeouts ───────────────────────────────────────────────────────
PAGE_TIMEOUT_MS            = 60_000   # 60 s for page.goto()
WAIT_FOR_SELECTOR_TIMEOUT_MS = 30_000  # 30 s for wait_for_selector()

# ── 429 permanent backoff ─────────────────────────────────────────────────────
BACKOFF_FILE = BASE_DIR / "backoff.json"


def load_backoff() -> dict:
    if BACKOFF_FILE.exists():
        return json.loads(BACKOFF_FILE.read_text())
    return {}


def check_backoff() -> None:
    """Abort at startup if the domain was previously rate-limited."""
    state = load_backoff()
    if DOMAIN in state:
        info = state[DOMAIN]
        raise SystemExit(
            f"[BACKOFF] {DOMAIN} was rate-limited at {info['banned_at']}. "
            f"Remove the entry from {BACKOFF_FILE} to resume."
        )


def record_ban(retry_after: str | None = None) -> None:
    """Call when a 429 is received.  Writes backoff.json then raises SystemExit."""
    state = load_backoff()
    state[DOMAIN] = {
        "banned_at": datetime.now(timezone.utc).isoformat(),
        "retry_after": retry_after,
    }
    BACKOFF_FILE.write_text(json.dumps(state, indent=2))
    raise SystemExit(
        f"[BACKOFF] 429 received from {DOMAIN}. "
        f"Written to {BACKOFF_FILE}. Do not resume until manually cleared."
    )
