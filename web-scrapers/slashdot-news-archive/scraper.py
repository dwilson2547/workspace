#!/usr/bin/env python3
# Site: Slashdot homepage firehose — https://slashdot.org/?page=N
# Strategy: static-html (plain `requests` replay confirmed in recon: HTTP 200 with full
#   article markup, no JS execution needed, no auth, no CAPTCHA on plain GET)
# Discovered endpoint / base URL: https://slashdot.org/?page=N   (page absent/0 = homepage)
# Last recon: 2026-11-05 (see docs/recon-2026-11-05.md)
# Selectors / fields: see SELECTORS below
#
# robots.txt: "/" and "/?page=N" are allowed (only /stories/, /comments.pl etc. are
#   Disallow-ed, and we never fetch those — the full story intro text is on the listing
#   page itself in div.body).
#
# Storage: SQLite at data/slashdot.db (override with SLASHDOT_DB). Stories are keyed by
#   Slashdot's firehose id (data-fhid), so runs are idempotent and resume-safe.
#   FTS5 virtual table gives keyword search now; story_embeddings is the hook for
#   semantic search later (fill with sqlite-vec / any embedder, keyed by story_id).
#
# Scheduling: intended to run once a day from cron, e.g.
#   0 7 * * * cd /home/daniel/documents/workspace/web-scrapers/slashdot-news-archive && python3 scraper.py scrape >> data/cron.log 2>&1
#
# Commands:
#   scrape [--max-pages N]     daily incremental run (default max-pages 10): fetch page 0,
#                              then walk ?page=1,2,... until a page yields zero new stories
#   backfill [--max-pages N]   one-time history fill (default max-pages 5000, reaches ~2016)
#   search QUERY [--limit N]   full-text search over titles + bodies (FTS5)
#   day [YYYY-MM-DD]           dump one day's stories as markdown (for agent-made summaries)
#   stats                      counts and date range
#
# Every target-site request goes through webcache (check-before-fetch) and a
# request-auth permit. --no-stack bypasses both for stack outages only.

import argparse
import fcntl
import logging
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("slashdot")

BASE_URL = "https://slashdot.org/"
DOMAIN = urlparse(BASE_URL).netloc
CLIENT_NAME = "slashdot_news_archive"

PROJECT_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("SLASHDOT_DB", PROJECT_DIR / "data" / "slashdot.db"))
LOCK_PATH = DB_PATH.parent / "scraper.lock"

WEBCACHE_URL = os.environ.get("WEBCACHE_URL", "http://webcache.scrapestack.local")
REQUEST_AUTH_SERVER_URL = os.environ.get(
    "REQUEST_AUTH_SERVER_URL", "request-auth-server.scrapestack.local:9000"
)
# Fresh enough that a daily run always refetches, but a manual re-run within the hour
# is served from webcache instead of hitting the site again.
CACHE_MAX_AGE_SECONDS = int(os.environ.get("CACHE_MAX_AGE_SECONDS", str(3600)))

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# ── Selectors (the only block to touch when the site redesigns) ────────────────
SELECTORS = {
    "story_article": "article.fhitem-story",          # data-fhtype="story"
    "firehose_id": "data-fhid",                       # attribute on the article
    "title_link": ".story-title a",                   # text + story URL
    "source_link": ".story-sourcelnk",                # "(domain.com)" external source
    "comment_count": ".comment-bubble a",             # text = comment count
    "byline_author": ".story-byline a",               # poster handle
    "byline_time": ".story-byline time",              # human text, e.g. "on ... @10:30PM"
    "dept": ".dept-text",
    "topic": ".topic a",                              # href …index2.pl?fhfilter=<topic>
    "body": "div.body",                               # full intro text (id=fhbody-<fhid>)
}

# //yro.slashdot.org/story/26/11/05/0322258/some-slug  →  section "yro", slug "some-slug"
# (the numeric time segment in the story URL is Slashdot's *submission* time in an
#  ambiguous variable-width encoding — NOT the publish time; do not use it for dates)
STORY_URL_RE = re.compile(
    r"^https?://(?P<section>[a-z0-9.-]*slashdot\.org)/story/"
    r"\d{2}/\d{2}/\d{2}/\d+/"
    r"(?P<slug>[^/?#]+)"
)

# Byline: "on Wednesday November 04, 2026 @10:30PM". Slashdot renders this in the
# viewer's timezone; the anonymous default is America/New_York. Verified 2026-11-05:
# parsing it as America/New_York and converting to UTC reproduces the slashdot.xml
# feed's UTC <time> exactly (15/15 homepage stories).
BYLINE_RE = re.compile(
    r"^on \w+ (?P<mon>\w+) (?P<day>\d+), (?P<yr>\d{4}) @(?P<hh>\d+):(?P<mi>\d+)(?P<ap>[AP]M)"
)
MONTHS = {m: i + 1 for i, m in enumerate(
    "January February March April May June July August September October November December".split()
)}
NY_TZ = ZoneInfo("America/New_York")
UTC_TZ = ZoneInfo("UTC")

SCHEMA = """
CREATE TABLE IF NOT EXISTS stories (
    story_id      INTEGER PRIMARY KEY,          -- Slashdot firehose id (data-fhid)
    posted_at     TEXT NOT NULL,                -- ISO 8601 UTC publish time (byline, NY tz -> UTC)
    title         TEXT NOT NULL,
    url           TEXT NOT NULL UNIQUE,         -- canonical story URL
    slug          TEXT,
    section       TEXT,                         -- subdomain: yro, tech, science, …
    source_domain TEXT,
    source_url    TEXT,
    author        TEXT,
    dept          TEXT,
    topic         TEXT,
    comment_count INTEGER,
    byline_time   TEXT,                         -- raw displayed time text
    body_text     TEXT,                         -- full post/intro text, plain
    body_html     TEXT,
    page_seen     INTEGER,                      -- first ?page=N this story appeared on
    first_seen_at TEXT NOT NULL,                -- when this scraper first saw it
    scraped_at    TEXT NOT NULL                 -- when this row was written
);
CREATE INDEX IF NOT EXISTS idx_stories_posted_at ON stories(posted_at);

CREATE VIRTUAL TABLE IF NOT EXISTS stories_fts USING fts5(
    title, body_text, content='stories', content_rowid='story_id'
);
CREATE TRIGGER IF NOT EXISTS stories_ai AFTER INSERT ON stories BEGIN
    INSERT INTO stories_fts(rowid, title, body_text) VALUES (new.story_id, new.title, new.body_text);
END;
CREATE TRIGGER IF NOT EXISTS stories_ad AFTER DELETE ON stories BEGIN
    INSERT INTO stories_fts(stories_fts, rowid, title, body_text) VALUES ('delete', old.story_id, old.title, old.body_text);
END;
CREATE TRIGGER IF NOT EXISTS stories_au AFTER UPDATE ON stories BEGIN
    INSERT INTO stories_fts(stories_fts, rowid, title, body_text) VALUES ('delete', old.story_id, old.title, old.body_text);
    INSERT INTO stories_fts(rowid, title, body_text) VALUES (new.story_id, new.title, new.body_text);
END;

-- Hook for semantic search: fill with any embedder (sqlite-vec, sentence-transformers, …),
-- keyed by story_id. Left empty until then.
CREATE TABLE IF NOT EXISTS story_embeddings (
    story_id    INTEGER PRIMARY KEY REFERENCES stories(story_id) ON DELETE CASCADE,
    model       TEXT NOT NULL,
    dim         INTEGER NOT NULL,
    vector      BLOB NOT NULL,
    embedded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
    id            INTEGER PRIMARY KEY,
    command       TEXT NOT NULL,
    started_at    TEXT NOT NULL,
    finished_at   TEXT,
    pages_fetched INTEGER NOT NULL DEFAULT 0,
    pages_cached  INTEGER NOT NULL DEFAULT 0,
    new_stories   INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'running',
    error         TEXT
);
"""


# ── storage ────────────────────────────────────────────────────────────────────

def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def init_db(db: sqlite3.Connection) -> None:
    db.executescript(SCHEMA)
    db.commit()


def insert_story(db: sqlite3.Connection, rec: dict) -> bool:
    """Insert one story; returns True if it was new. Commits immediately (incremental save)."""
    cur = db.execute(
        """
        INSERT OR IGNORE INTO stories (
            story_id, posted_at, title, url, slug, section, source_domain, source_url,
            author, dept, topic, comment_count, byline_time, body_text, body_html,
            page_seen, first_seen_at, scraped_at
        ) VALUES (
            :story_id, :posted_at, :title, :url, :slug, :section, :source_domain, :source_url,
            :author, :dept, :topic, :comment_count, :byline_time, :body_text, :body_html,
            :page_seen, :first_seen_at, :scraped_at
        )
        """,
        rec,
    )
    db.commit()
    return cur.rowcount > 0


# ── parsing ────────────────────────────────────────────────────────────────────

def parse_section_slug(story_url: str):
    """Return (section, slug) parsed from the story URL host + slug."""
    m = STORY_URL_RE.match(story_url)
    if not m:
        return None, None
    d = m.groupdict()
    section = d["section"].split(".")[0] or "slashdot"
    return section, d["slug"]


def parse_posted_at(byline_time: str | None):
    """Parse the displayed byline time (Slashdot anonymous default tz = America/New_York)
    into an ISO 8601 UTC publish timestamp."""
    if not byline_time:
        return None
    m = BYLINE_RE.match(byline_time.strip())
    if not m:
        return None
    d = m.groupdict()
    hh = int(d["hh"]) % 12 + (12 if d["ap"] == "PM" else 0)
    local = datetime(
        int(d["yr"]), MONTHS[d["mon"]], int(d["day"]), hh, int(d["mi"]), tzinfo=NY_TZ
    )
    return local.astimezone(UTC_TZ).isoformat(timespec="seconds")


def parse_story(article, page_url: str, page_num: int) -> dict | None:
    fhid = article.get(SELECTORS["firehose_id"])
    title_el = article.select_one(SELECTORS["title_link"])
    if not fhid or not title_el or not title_el.get("href"):
        return None

    url = urljoin(page_url, title_el["href"])
    section, slug = parse_section_slug(url)

    src = article.select_one(SELECTORS["source_link"])
    cmt = article.select_one(SELECTORS["comment_count"])
    author = article.select_one(SELECTORS["byline_author"])
    time_el = article.select_one(SELECTORS["byline_time"])
    dept = article.select_one(SELECTORS["dept"])
    topic = article.select_one(SELECTORS["topic"])
    body = article.select_one(SELECTORS["body"])

    byline_time = time_el.get_text(strip=True) if time_el else None
    posted_at = parse_posted_at(byline_time)
    if posted_at is None or section is None:
        logger.warning("skipping article %s: unparseable URL or byline time (%s | %s)", fhid, url, byline_time)
        return None

    topic_name = None
    if topic and topic.get("href"):
        m = re.search(r"fhfilter=([^&]+)", topic["href"])
        topic_name = m.group(1) if m else None

    body_text = body.get_text("\n", strip=True) if body else ""

    return {
        "story_id": int(fhid),
        "posted_at": posted_at,
        "title": title_el.get_text(strip=True),
        "url": url,
        "slug": slug,
        "section": section,
        "source_domain": (src.get_text(strip=True).strip("()") if src else None),
        "source_url": (urljoin(page_url, src["href"]) if src and src.get("href") else None),
        "author": (author.get_text(strip=True) if author else None),
        "dept": (dept.get_text(strip=True) if dept else None),
        "topic": topic_name,
        "comment_count": (int(cmt.get_text(strip=True)) if cmt and cmt.get_text(strip=True).isdigit() else None),
        "byline_time": byline_time,
        "body_text": body_text,
        "body_html": (str(body) if body else None),
        "page_seen": page_num,
        "first_seen_at": utcnow(),
        "scraped_at": utcnow(),
    }


def parse_page(html: str, page_url: str, page_num: int) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    stories = []
    for article in soup.select(SELECTORS["story_article"]):
        rec = parse_story(article, page_url, page_num)
        if rec:
            stories.append(rec)
    return stories


# ── fetching (scrape-stack: cache before fetch, permit per target request) ─────

class Stack:
    """webcache + request-auth wiring. use_stack=False bypasses both (outage escape hatch)."""

    def __init__(self, use_stack: bool = True):
        self.use_stack = use_stack
        self.web_cache = None
        self.request_auth = None
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT

    def __enter__(self):
        if self.use_stack:
            from cache_client import WebCacheClient
            from request_auth_client import RequestAuthClient

            self.web_cache = WebCacheClient(WEBCACHE_URL)
            self.request_auth = RequestAuthClient(REQUEST_AUTH_SERVER_URL)
        return self

    def __exit__(self, *exc):
        if self.request_auth:
            self.request_auth.close()
        if self.web_cache:
            self.web_cache.close()
        self.session.close()

    def fetch_page(self, url: str) -> tuple[str, bool]:
        """Return (html, from_cache). Check-before-fetch via webcache; target GET under a permit."""
        if self.web_cache:
            entry = self.web_cache.get(url, max_age=CACHE_MAX_AGE_SECONDS)
            if entry:
                logger.debug("cache hit %s", url)
                return entry["content"], True

        if self.request_auth:
            with self.request_auth.acquire(DOMAIN) as permit:
                resp = self.session.get(url, timeout=30)
                permit.set_status(resp.status_code)
                if resp.status_code == 429:
                    raise RuntimeError(f"429 from {DOMAIN}; request-auth has been informed — stopping run")
                resp.raise_for_status()
                html = resp.text
        else:
            logger.warning("--no-stack: fetching %s without cache/permit", url)
            resp = self.session.get(url, timeout=30)
            resp.raise_for_status()
            html = resp.text

        if self.web_cache:
            self.web_cache.store(url, html, CLIENT_NAME)
        return html, False


# ── scrape loop ────────────────────────────────────────────────────────────────

def page_url(n: int) -> str:
    return BASE_URL if n == 0 else f"{BASE_URL}?page={n}"


def run_scrape(db: sqlite3.Connection, command: str, max_pages: int, use_stack: bool) -> int:
    run_id = db.execute(
        "INSERT INTO runs (command, started_at) VALUES (?, ?)", (command, utcnow())
    ).lastrowid
    db.commit()

    # Deepest page already in the DB at run start. `backfill` must not stop at an
    # all-known page before passing this frontier (shallow pages can be known from a
    # recent scrape while deeper ones were never fetched); `scrape` stops at the first
    # all-known page, which is correct once the archive is contiguous and caught up.
    row = db.execute("SELECT MAX(page_seen) FROM stories").fetchone()
    deepest_known = row[0] if row and row[0] is not None else -1
    is_backfill = command == "backfill"

    pages_fetched = pages_cached = new_stories = 0
    status, error = "ok", None
    try:
        with Stack(use_stack) as stack:
            for n in range(0, max_pages + 1):
                url = page_url(n)
                html, from_cache = stack.fetch_page(url)
                pages_fetched += 1
                pages_cached += 1 if from_cache else 0
                stories = parse_page(html, url, n)
                added = 0
                for rec in stories:
                    if insert_story(db, rec):
                        added += 1
                new_stories += added
                logger.info(
                    "page=%d stories=%d new=%d%s", n, len(stories), added,
                    " (cache)" if from_cache else "",
                )
                if len(stories) == 0:
                    logger.warning("page %d parsed zero stories — stopping (selector drift?)", n)
                    break
                if added == 0 and n > 0 and (not is_backfill or n > deepest_known):
                    logger.info("page %d had no new stories — gap filled, stopping", n)
                    break
    except Exception as e:  # self-classify per scraper doctrine
        status, error = "error", f"{type(e).__name__}: {e}"
        logger.error("run failed: %s", error)
        raise
    finally:
        db.execute(
            "UPDATE runs SET finished_at=?, pages_fetched=?, pages_cached=?, new_stories=?, status=?, error=? WHERE id=?",
            (utcnow(), pages_fetched, pages_cached, new_stories, status, error, run_id),
        )
        db.commit()
    logger.info(
        "run done: pages_fetched=%d (cached=%d) new_stories=%d", pages_fetched, pages_cached, new_stories
    )
    return new_stories


# ── read-only commands ─────────────────────────────────────────────────────────

def cmd_search(db: sqlite3.Connection, query: str, limit: int) -> None:
    rows = db.execute(
        """
        SELECT s.story_id, s.posted_at, s.title, s.url, s.source_domain,
               snippet(stories_fts, 1, '[', ']', '…', 12) AS snip
        FROM stories_fts f JOIN stories s ON s.story_id = f.rowid
        WHERE stories_fts MATCH ?
        ORDER BY rank LIMIT ?
        """,
        (query, limit),
    ).fetchall()
    if not rows:
        print("no matches")
        return
    for r in rows:
        print(f"[{r[1]}] {r[2]}\n    {r[3]}  ({r[4]})\n    {r[5]}\n")


def cmd_day(db: sqlite3.Connection, date_str: str | None) -> None:
    if date_str is None:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rows = db.execute(
        """
        SELECT posted_at, title, url, section, source_domain, source_url, author, dept,
               topic, comment_count, body_text
        FROM stories WHERE substr(posted_at, 1, 10) = ? ORDER BY posted_at
        """,
        (date_str,),
    ).fetchall()
    print(f"# Slashdot stories — {date_str} ({len(rows)} stories)\n")
    for i, r in enumerate(rows, 1):
        (posted, title, url, section, src_dom, src_url, author, dept, topic, comments, body) = r
        meta = f"{posted} UTC · section={section}"
        if src_dom:
            meta += f" · source={src_dom}"
        if dept:
            meta += f" · dept={dept}"
        if topic:
            meta += f" · topic={topic}"
        if author:
            meta += f" · by {author}"
        if comments is not None:
            meta += f" · {comments} comments"
        print(f"## {i}. {title}\n{meta}\n{url}\n")
        if src_url:
            print(f"source article: {src_url}\n")
        print(f"{body}\n")


def cmd_stats(db: sqlite3.Connection) -> None:
    total, lo, hi = db.execute(
        "SELECT COUNT(*), MIN(posted_at), MAX(posted_at) FROM stories"
    ).fetchone()
    print(f"stories: {total}")
    print(f"posted_at range: {lo} … {hi}")
    for row in db.execute(
        "SELECT status, COUNT(*), SUM(new_stories), MAX(finished_at) FROM runs GROUP BY status"
    ):
        print(f"runs {row[0]}: {row[1]} runs, {row[2]} new stories, last {row[3]}")


# ── main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description="Slashdot homepage story archive")
    ap.add_argument("--no-stack", action="store_true",
                    help="bypass webcache/request-auth (stack outage only)")
    sub = ap.add_subparsers(dest="command", required=True)

    p_scrape = sub.add_parser("scrape", help="daily incremental run")
    p_scrape.add_argument("--max-pages", type=int, default=10)

    p_back = sub.add_parser("backfill", help="one-time history fill")
    p_back.add_argument("--max-pages", type=int, default=5000)

    p_search = sub.add_parser("search", help="full-text search")
    p_search.add_argument("query")
    p_search.add_argument("--limit", type=int, default=10)

    p_day = sub.add_parser("day", help="dump one day's stories as markdown")
    p_day.add_argument("date", nargs="?", default=None, help="YYYY-MM-DD (default: today UTC)")

    sub.add_parser("stats", help="counts and date range")

    args = ap.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.StreamHandler(), logging.FileHandler(DB_PATH.parent / "scraper.log")],
    )
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOCK_PATH, "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            logger.error("another run holds %s — exiting", LOCK_PATH)
            sys.exit(1)

        db = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
        init_db(db)
        # the lock is held, so any row still 'running' is from a killed process
        db.execute("UPDATE runs SET status='interrupted', error='process killed' WHERE status='running'")
        db.commit()
        try:
            if args.command == "scrape":
                run_scrape(db, "scrape", args.max_pages, use_stack=not args.no_stack)
            elif args.command == "backfill":
                run_scrape(db, "backfill", args.max_pages, use_stack=not args.no_stack)
            elif args.command == "search":
                cmd_search(db, args.query, args.limit)
            elif args.command == "day":
                cmd_day(db, args.date)
            elif args.command == "stats":
                cmd_stats(db)
        finally:
            db.close()


if __name__ == "__main__":
    main()
