#!/usr/bin/env python3
# Site: Slashdot homepage firehose — https://slashdot.org/?page=N
# Strategy: static-html (plain `requests` replay confirmed in recon: HTTP 200 with full
#   article markup, no JS execution needed, no auth, no CAPTCHA on plain GET)
# Discovered endpoint / base URL: https://slashdot.org/?page=N   (page absent/0 = homepage)
# Last recon: 2026-11-05 (see docs/recon-2026-11-05.md)
# Selectors / fields: see SELECTORS below
#
# Runs as a daily scrape-job-manager job (Scraper/ScrapeJob/ScrapePool CRs in
# infra/cluster-config/slashdot-news/) and also standalone from a shell.
#   - storage: Postgres+pgvector (DATABASE_URL, cluster postgres-pgvector), stories keyed by
#     firehose id; FTS via generated tsvector; semantic search via story_embeddings
#     (all-MiniLM-L6-v2, 384-dim, computed in-pod by sentence-transformers — no external
#     embedding service)
#   - target requests: check-before-fetch via webcache, each under a request-auth permit
#   - exit codes / result payload: scrape_contract (0 / 75 / 65), SCRAPE_DEADLINE honored
#
# robots.txt: "/" and "/?page=N" are allowed (only /stories/, /comments.pl etc. are
#   Disallow-ed, and we never fetch those — the full story intro text is on the listing
#   page itself in div.body).
#
# Usage:
#   python3 scraper.py                          # daily incremental scrape (default command)
#   python3 scraper.py scrape [--max-pages N]   # same, explicit; walks ?page=N until an
#                                               # all-known page (gap fill), default 10
#   python3 scraper.py backfill [--max-pages N] # one-time deep fill, default 5000 (~2016)
#   python3 scraper.py embed [--limit N]        # embed stories missing embeddings (default 500)
#   python3 scraper.py search QUERY [--limit N] [--semantic] [--hybrid]
#   python3 scraper.py day [YYYY-MM-DD]         # one day's stories as markdown (agent summaries)
#   python3 scraper.py stats
#
# Env: DATABASE_URL (required), WEBCACHE_URL, REQUEST_AUTH_SERVER_URL, CACHE_MAX_AGE_SECONDS,
#      EMBEDDING_MODEL, SCRAPE_DEADLINE (injected by the operator), SLASHDOT_NO_STACK=1 to
#      bypass webcache/request-auth (local testing / stack outage only).

import argparse
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup
from scrape_contract import Broken, Transient, run

logger = logging.getLogger("slashdot")

BASE_URL = "https://slashdot.org/"
DOMAIN = urlparse(BASE_URL).netloc
CLIENT_NAME = "slashdot_news_archive"

DATABASE_URL = os.environ.get("DATABASE_URL", "")
WEBCACHE_URL = os.environ.get("WEBCACHE_URL", "http://webcache.scrape-stack.svc.cluster.local:8000")
REQUEST_AUTH_SERVER_URL = os.environ.get(
    "REQUEST_AUTH_SERVER_URL", "request-auth-server.scrape-stack.svc.cluster.local:9000"
)
CACHE_MAX_AGE_SECONDS = int(os.environ.get("CACHE_MAX_AGE_SECONDS", str(3600)))
NO_STACK = os.environ.get("SLASHDOT_NO_STACK", "") == "1"

EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "384"))
EMBED_MAX_CHARS = int(os.environ.get("EMBED_MAX_CHARS", "4000"))  # bound CPU per story

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# scrape-job-manager injects SCRAPE_DEADLINE (RFC 3339) — stop gracefully at that time.
_DEADLINE = None


def _parse_deadline():
    global _DEADLINE
    raw = os.environ.get("SCRAPE_DEADLINE")
    if not raw:
        return
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("Unparseable SCRAPE_DEADLINE %r — ignoring", raw)
        return
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    _DEADLINE = parsed


def _deadline_hit() -> bool:
    return _DEADLINE is not None and datetime.now(timezone.utc) >= _DEADLINE


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
    story_id      BIGINT PRIMARY KEY,           -- Slashdot firehose id (data-fhid)
    posted_at     TIMESTAMPTZ NOT NULL,         -- publish time, UTC (byline, NY tz -> UTC)
    title         TEXT NOT NULL,
    url           TEXT NOT NULL UNIQUE,
    slug          TEXT,
    section       TEXT,
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
    first_seen_at TIMESTAMPTZ NOT NULL,
    scraped_at    TIMESTAMPTZ NOT NULL,
    search_tsv    TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', title || ' ' || coalesce(body_text, ''))
    ) STORED
);
CREATE INDEX IF NOT EXISTS idx_stories_posted_at ON stories (posted_at);
CREATE INDEX IF NOT EXISTS idx_stories_search ON stories USING GIN (search_tsv);

-- Semantic search vectors (pgvector). model/dim recorded per row; embedding is
-- all-MiniLM-L6-v2 (384-dim), cosine-normalized, computed in-pod.
CREATE TABLE IF NOT EXISTS story_embeddings (
    story_id    BIGINT PRIMARY KEY REFERENCES stories(story_id) ON DELETE CASCADE,
    model       TEXT NOT NULL,
    dim         INTEGER NOT NULL,
    embedding   vector(384) NOT NULL,
    embedded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_story_embeddings_hnsw
    ON story_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS runs (
    id            BIGSERIAL PRIMARY KEY,
    command       TEXT NOT NULL,
    started_at    TIMESTAMPTZ NOT NULL,
    finished_at   TIMESTAMPTZ,
    pages_fetched INTEGER NOT NULL DEFAULT 0,
    pages_cached  INTEGER NOT NULL DEFAULT 0,
    new_stories   INTEGER NOT NULL DEFAULT 0,
    embedded      INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'running',
    error         TEXT
);
"""


# ── storage ────────────────────────────────────────────────────────────────────

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def connect():
    if not DATABASE_URL:
        raise Broken("DATABASE_URL is not set (cluster: secret slashdot-news-db key DATABASE_URL)")
    try:
        conn = psycopg2.connect(DATABASE_URL)
    except psycopg2.OperationalError as e:
        raise Transient(f"postgres unreachable: {e}")
    conn.autocommit = False
    try:
        from pgvector.psycopg2 import register_vector
        register_vector(conn)
    except ImportError:
        pass
    with conn.cursor() as cur:
        cur.execute(SCHEMA)
    conn.commit()
    return conn


def insert_story(conn, rec: dict) -> bool:
    """Insert one story; returns True if it was new. Commits immediately (incremental save)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO stories (
                story_id, posted_at, title, url, slug, section, source_domain, source_url,
                author, dept, topic, comment_count, byline_time, body_text, body_html,
                page_seen, first_seen_at, scraped_at
            ) VALUES (
                %(story_id)s, %(posted_at)s, %(title)s, %(url)s, %(slug)s, %(section)s,
                %(source_domain)s, %(source_url)s, %(author)s, %(dept)s, %(topic)s,
                %(comment_count)s, %(byline_time)s, %(body_text)s, %(body_html)s,
                %(page_seen)s, %(first_seen_at)s, %(scraped_at)s
            ) ON CONFLICT (story_id) DO NOTHING
            """,
            rec,
        )
        new = cur.rowcount > 0
    conn.commit()
    return new


# ── parsing ────────────────────────────────────────────────────────────────────

def parse_section_slug(story_url: str):
    m = STORY_URL_RE.match(story_url)
    if not m:
        return None, None
    d = m.groupdict()
    section = d["section"].split(".")[0] or "slashdot"
    return section, d["slug"]


def parse_posted_at(byline_time: str | None):
    """Parse the displayed byline time (anonymous default tz America/New_York) to UTC."""
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
    return local.astimezone(UTC_TZ)


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

    now = utcnow()
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
        "body_text": (body.get_text("\n", strip=True) if body else ""),
        "body_html": (str(body) if body else None),
        "page_seen": page_num,
        "first_seen_at": now,
        "scraped_at": now,
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
    def __init__(self, use_stack: bool = True):
        self.use_stack = use_stack and not NO_STACK
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
                    raise Broken(f"429 from {DOMAIN}; request-auth informed — blocked")
                resp.raise_for_status()
                html = resp.text
        else:
            logger.warning("NO_STACK: fetching %s without cache/permit", url)
            resp = self.session.get(url, timeout=30)
            resp.raise_for_status()
            html = resp.text

        if self.web_cache:
            self.web_cache.store(url, html, CLIENT_NAME)
        return html, False


# ── embeddings (in-pod, sentence-transformers, no external service) ─────────────

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        logger.info("loading embedding model %s", EMBEDDING_MODEL)
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def embed_stories(conn, limit: int) -> int:
    """Embed stories that have no embedding row yet. Returns count embedded."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT s.story_id, s.title, s.body_text FROM stories s
            LEFT JOIN story_embeddings e ON e.story_id = s.story_id
            WHERE e.story_id IS NULL ORDER BY s.posted_at DESC LIMIT %s
            """,
            (limit,),
        )
        rows = cur.fetchall()
    if not rows:
        return 0

    model = _get_model()
    texts = [(t + "\n" + (b or ""))[:EMBED_MAX_CHARS] for _, t, b in rows]
    logger.info("embedding %d stories with %s", len(texts), EMBEDDING_MODEL)
    vecs = model.encode(texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False)

    with conn.cursor() as cur:
        for (story_id, _, _), vec in zip(rows, vecs):
            cur.execute(
                """
                INSERT INTO story_embeddings (story_id, model, dim, embedding, embedded_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (story_id) DO NOTHING
                """,
                (story_id, EMBEDDING_MODEL, EMBEDDING_DIM, vec, utcnow()),
            )
    conn.commit()
    return len(rows)


def embed_query(text: str):
    model = _get_model()
    return model.encode([text[:EMBED_MAX_CHARS]], normalize_embeddings=True)[0]


# ── scrape loop ────────────────────────────────────────────────────────────────

def page_url(n: int) -> str:
    return BASE_URL if n == 0 else f"{BASE_URL}?page={n}"


def run_scrape(conn, command: str, max_pages: int, do_embed: bool, embed_limit: int) -> dict:
    _parse_deadline()
    with conn.cursor() as cur:
        cur.execute("INSERT INTO runs (command, started_at) VALUES (%s, %s) RETURNING id", (command, utcnow()))
        run_id = cur.fetchone()[0]
    conn.commit()

    # Deepest page already in the DB. `backfill` must not stop at an all-known page before
    # passing this frontier (shallow pages can be known from a recent scrape while deeper
    # ones were never fetched); `scrape` stops at the first all-known page, which is
    # correct once the archive is contiguous and caught up.
    with conn.cursor() as cur:
        cur.execute("SELECT COALESCE(MAX(page_seen), -1) FROM stories")
        deepest_known = cur.fetchone()[0]
    is_backfill = command == "backfill"

    pages_fetched = pages_cached = new_stories = 0
    status, error = "ok", None
    try:
        with Stack() as stack:
            for n in range(0, max_pages + 1):
                if _deadline_hit():
                    logger.warning("SCRAPE_DEADLINE reached — stopping gracefully at page %d", n)
                    break
                url = page_url(n)
                html, from_cache = stack.fetch_page(url)
                pages_fetched += 1
                pages_cached += 1 if from_cache else 0
                stories = parse_page(html, url, n)
                added = 0
                for rec in stories:
                    if insert_story(conn, rec):
                        added += 1
                new_stories += added
                logger.info("page=%d stories=%d new=%d%s", n, len(stories), added,
                            " (cache)" if from_cache else "")
                if len(stories) == 0:
                    if is_backfill and n > deepest_known:
                        logger.info("page %d is empty — end of the listing archive, stopping", n)
                        break
                    raise Broken(f"page {n} parsed zero stories — selector drift?")
                if added == 0 and n > 0 and (not is_backfill or n > deepest_known):
                    logger.info("page %d had no new stories — gap filled, stopping", n)
                    break
                if n % 100 == 0:
                    logger.info("progress: page=%d new_stories=%d", n, new_stories)
    except Exception as e:
        status, error = "error", f"{type(e).__name__}: {e}"
        logger.error("run failed: %s", error)
        conn.rollback()
        raise
    finally:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE runs SET finished_at=%s, pages_fetched=%s, pages_cached=%s,
                   new_stories=%s, status=%s, error=%s WHERE id=%s""",
                (utcnow(), pages_fetched, pages_cached, new_stories, status, error, run_id),
            )
        conn.commit()

    embedded = 0
    if do_embed and new_stories > 0:
        embedded = embed_stories(conn, embed_limit)
        with conn.cursor() as cur:
            cur.execute("UPDATE runs SET embedded=%s WHERE id=%s", (embedded, run_id))
        conn.commit()

    logger.info("run done: pages_fetched=%d (cached=%d) new_stories=%d embedded=%d",
                pages_fetched, pages_cached, new_stories, embedded)
    return {
        "items": pages_fetched,
        "pages": pages_fetched,
        "pages_cached": pages_cached,
        "new": new_stories,
        "embedded": embedded,
    }


# ── read-only commands ─────────────────────────────────────────────────────────

def cmd_search(conn, query: str, limit: int, semantic: bool, hybrid: bool) -> None:
    with conn.cursor() as cur:
        if semantic or hybrid:
            qvec = embed_query(query)
            cur.execute(
                """
                SELECT s.story_id, s.posted_at, s.title, s.url, s.source_domain,
                       1 - (e.embedding <=> %s) AS score
                FROM story_embeddings e JOIN stories s ON s.story_id = e.story_id
                ORDER BY e.embedding <=> %s LIMIT %s
                """,
                (qvec, qvec, limit * 3),
            )
            sem = cur.fetchall()
        else:
            sem = []
        if not semantic:
            cur.execute(
                """
                SELECT s.story_id, s.posted_at, s.title, s.url, s.source_domain,
                       ts_rank(s.search_tsv, plainto_tsquery('english', %s)) AS score
                FROM stories s
                WHERE s.search_tsv @@ plainto_tsquery('english', %s)
                ORDER BY score DESC LIMIT %s
                """,
                (query, query, limit * 3),
            )
            fts = cur.fetchall()
        else:
            fts = []

    if hybrid:
        # reciprocal rank fusion over the two ranked lists
        scores = {}
        for rank, rows in ((0, fts), (1, sem)):
            for i, r in enumerate(rows):
                scores[r[0]] = scores.get(r[0], 0.0) + 1.0 / (60 + i + 1)
        by_id = {r[0]: r for r in fts + sem}
        ranked = sorted(scores, key=scores.get, reverse=True)[:limit]
        rows = [by_id[i] for i in ranked]
    else:
        rows = (sem if semantic else fts)[:limit]

    if not rows:
        print("no matches")
        return
    for r in rows:
        print(f"[{r[1]:%Y-%m-%d %H:%M} UTC] (score {r[5]:.3f}) {r[2]}\n    {r[3]}  ({r[4]})\n")


def cmd_day(conn, date_str: str | None) -> None:
    if date_str is None:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT posted_at, title, url, section, source_domain, source_url, author, dept,
                   topic, comment_count, body_text
            FROM stories WHERE posted_at::date = %s ORDER BY posted_at
            """,
            (date_str,),
        )
        rows = cur.fetchall()
    print(f"# Slashdot stories — {date_str} ({len(rows)} stories)\n")
    for i, r in enumerate(rows, 1):
        (posted, title, url, section, src_dom, src_url, author, dept, topic, comments, body) = r
        meta = f"{posted:%Y-%m-%d %H:%M} UTC · section={section}"
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


def cmd_stats(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*), MIN(posted_at), MAX(posted_at) FROM stories")
        total, lo, hi = cur.fetchone()
        cur.execute("SELECT COUNT(*) FROM story_embeddings")
        emb = cur.fetchone()[0]
        print(f"stories: {total}  (embedded: {emb})")
        print(f"posted_at range: {lo} … {hi}")
        cur.execute(
            "SELECT status, COUNT(*), SUM(new_stories), MAX(finished_at) FROM runs GROUP BY status"
        )
        for row in cur.fetchall():
            print(f"runs {row[0]}: {row[1]} runs, {row[2]} new stories, last {row[3]}")


# ── main ───────────────────────────────────────────────────────────────────────

def main() -> dict:
    ap = argparse.ArgumentParser(description="Slashdot homepage story archive (Postgres+pgvector)")
    # top-level flags apply to the default `scrape` command (what the operator runs);
    # subcommand flags use SUPPRESS so they only override when explicitly given
    ap.add_argument("--max-pages", type=int, default=None,
                    help="page cap (default 10 for scrape, 5000 for backfill)")
    ap.add_argument("--no-embed", action="store_true")
    ap.add_argument("--embed-limit", type=int, default=1000)
    sub = ap.add_subparsers(dest="command")

    p_scrape = sub.add_parser("scrape", help="daily incremental run (default)")
    p_scrape.add_argument("--max-pages", type=int, default=argparse.SUPPRESS)
    p_scrape.add_argument("--no-embed", action="store_true", default=argparse.SUPPRESS)
    p_scrape.add_argument("--embed-limit", type=int, default=argparse.SUPPRESS)

    p_back = sub.add_parser("backfill", help="one-time history fill")
    p_back.add_argument("--max-pages", type=int, default=argparse.SUPPRESS)
    p_back.add_argument("--no-embed", action="store_true", default=argparse.SUPPRESS)
    p_back.add_argument("--embed-limit", type=int, default=argparse.SUPPRESS)

    p_embed = sub.add_parser("embed", help="embed stories missing embeddings")
    p_embed.add_argument("--limit", type=int, default=500)

    p_search = sub.add_parser("search", help="search stories")
    p_search.add_argument("query")
    p_search.add_argument("--limit", type=int, default=10)
    p_search.add_argument("--semantic", action="store_true", help="vector search instead of FTS")
    p_search.add_argument("--hybrid", action="store_true", help="RRF merge of FTS + vector")

    p_day = sub.add_parser("day", help="dump one day's stories as markdown")
    p_day.add_argument("date", nargs="?", default=None, help="YYYY-MM-DD (default: today UTC)")

    sub.add_parser("stats", help="counts and date range")

    args = ap.parse_args()
    command = args.command or "scrape"

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    conn = connect()
    try:
        if command in ("scrape", "backfill"):
            default_pages = 5000 if command == "backfill" else 10
            return run_scrape(conn, command,
                              max_pages=args.max_pages if args.max_pages is not None else default_pages,
                              do_embed=not args.no_embed,
                              embed_limit=args.embed_limit)
        if command == "embed":
            n = embed_stories(conn, getattr(args, "limit", 500))
            print(f"embedded {n} stories")
            return {"embedded": n}
        if command == "search":
            cmd_search(conn, args.query, args.limit, args.semantic, args.hybrid)
            return {"items": 0}
        if command == "day":
            cmd_day(conn, args.date)
            return {"items": 0}
        if command == "stats":
            cmd_stats(conn)
            return {"items": 0}
    finally:
        conn.close()
    return {}


if __name__ == "__main__":
    run(main)
