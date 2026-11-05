---
tier: project
domains: web-scrapers
---

# slashdot-news-archive

Daily scraper for the [Slashdot](https://slashdot.org/) homepage firehose. Fetches
`https://slashdot.org/` (and `?page=N` to fill gaps), parses every story — title, post
time, author, dept, source, comment count, and the full post text that Slashdot shows
inline — and stores them in a local SQLite database.

Built for three things:

1. **A history of events and dates** — every story with its publish time as UTC (parsed
   from the displayed byline in Slashdot's anonymous-default America/New_York timezone;
   verified to match the `slashdot.xml` feed's UTC times exactly), idempotent by
   Slashdot's firehose id.
2. **Search** — FTS5 keyword search now (`search` command); the `story_embeddings` table
   is the hook for semantic search later (fill it with sqlite-vec or any embedder, keyed
   by `story_id`).
3. **Daily summaries by a local agent** — `python3 scraper.py day [YYYY-MM-DD]` dumps one
   day's stories as markdown; pipe it into any agent to get a summary, e.g.
   `python3 scraper.py day | vibe "summarize today's Slashdot stories in 5 bullets"`.

## How it works

- Strategy: **static HTML** — recon (2026-11-05, see `docs/recon-2026-11-05.md`) confirmed
  a plain `requests` GET returns the full article markup; no browser needed.
- `scrape` fetches page 0, then walks `?page=1,2,…` until a page yields zero new stories
  (the gap-fill), capped by `--max-pages` (default 10). `backfill` does the same with a
  much deeper cap (default 5000 pages ≈ back to 2016) for the initial history load.
- Every target request is check-before-fetch through **webcache** and wrapped in a
  **request-auth** permit (scrape-stack). `--no-stack` bypasses both for stack outages.
- robots.txt allows `/` and `/?page=N`; individual `/stories/` pages are Disallow-ed and
  are never fetched — the full post text is already on the listing page.
- Stories are inserted one at a time (incremental saves) and the run is recorded in the
  `runs` table, so interrupted runs resume cleanly. A lockfile prevents overlapping runs.

## Usage

```bash
pip install -r requirements.txt

python3 scraper.py backfill --max-pages 200   # one-time: seed some history
python3 scraper.py scrape                      # daily incremental run
python3 scraper.py search "EU AI act" --limit 5
python3 scraper.py day 2026-11-05              # markdown dump of one day
python3 scraper.py stats
```

### Run once a day from cron

```cron
0 7 * * * cd /home/daniel/documents/workspace/web-scrapers/slashdot-news-archive && /home/daniel/anaconda3/envs/py39/bin/python3 scraper.py scrape >> data/cron.log 2>&1
```

(Adjust the python path to the interpreter that has `requirements.txt` installed.)

## Storage

`data/slashdot.db` (gitignored; override with `SLASHDOT_DB`):

- `stories` — one row per story: `story_id` (PK, firehose id), `posted_at` (UTC ISO,
  from the byline time),
  `title`, `url`, `slug`, `section`, `source_domain`, `source_url`, `author`, `dept`,
  `topic`, `comment_count`, `byline_time`, `body_text`, `body_html`, `page_seen`,
  `first_seen_at`, `scraped_at`
- `stories_fts` — FTS5 over title + body (kept in sync by triggers)
- `story_embeddings` — empty hook for semantic search vectors
- `runs` — one row per scrape/backfill run with counts and status

## Env vars

| Var | Default | Meaning |
|---|---|---|
| `SLASHDOT_DB` | `data/slashdot.db` | database path |
| `WEBCACHE_URL` | `http://webcache.scrapestack.local` | scrape-stack webcache |
| `REQUEST_AUTH_SERVER_URL` | `request-auth-server.scrapestack.local:9000` | scrape-stack request-auth (gRPC) |
| `CACHE_MAX_AGE_SECONDS` | `3600` | webcache freshness; daily cron always refetches |

## Volume / egress

Daily run: 1 + up to `--max-pages` requests to slashdot.org (typically 1–3 once the
archive is caught up). Initial backfill to 2016 is ~5000 one-shot requests — the
"low thousands, one-shot" band, fine on home egress. All requests are paced by
request-auth permits.
