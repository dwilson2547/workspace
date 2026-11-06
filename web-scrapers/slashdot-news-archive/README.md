---
tier: project
domains: web-scrapers
---

# slashdot-news-archive

Daily scraper for the [Slashdot](https://slashdot.org/) homepage firehose. Fetches
`https://slashdot.org/` (and `?page=N` to fill gaps), parses every story — title, publish
time, author, dept, source, comment count, and the full post text that Slashdot shows
inline — and stores them in **Postgres+pgvector in the cluster**, with embeddings for
semantic search.

Built for three things:

1. **A history of events and dates** — every story with its publish time as UTC (parsed
   from the displayed byline in Slashdot's anonymous-default America/New_York timezone;
   verified to match the `slashdot.xml` feed's UTC times 15/15), keyed by Slashdot's
   firehose id so runs are idempotent.
2. **Search** — FTS keyword search (`search`) plus **semantic search** over pgvector
   embeddings (`search --semantic`, `--hybrid` for RRF merge). Embeddings are
   all-MiniLM-L6-v2 (384-dim, cosine-normalized), computed **in the scraper pod** by
   sentence-transformers (model baked into the image; no external embedding service).
   New stories are embedded automatically at the end of each scrape.
3. **Daily summaries by a local agent** — `python3 scraper.py day [YYYY-MM-DD]` dumps one
   day's stories as markdown; pipe it into any agent, e.g.
   `python3 scraper.py day | vibe "summarize today's Slashdot stories in 5 bullets"`.

## Running it (scrape-job-manager, daily)

Deployed as a scrape-job-manager fleet in `infra/cluster-config/slashdot-news/` (cluster_config
repo): `Scraper` (image `dwilson2547/slashdot-news-archive`, pinned by digest) +
`ScrapeJob` + `ScrapePool` (`every: 1d`, active 06:00–08:00 America/New_York). The operator
dispatches one batch Job per day; the scraper honors `SCRAPE_DEADLINE`, exits per the
`scrape_contract` (0/75/65) with a JSON result in the termination log.

```bash
kubectl -n slashdot-news get scrapejob slashdot-news          # status
kubectl -n slashdot-news annotate scrapejob slashdot-news scrape.danwils.com/run-now=$(date +%s) --overwrite   # manual run
kubectl -n slashdot-news logs job/<latest>                     # run log
```

Database: `slashdot_news` on `postgres-pgvector.postgres.svc.cluster.local` (role/db/`vector`
extension provisioned by `infra/cluster-config/postgres/init-slashdot-news.sql`; credentials in
the `slashdot-news-db` Secret, template in `infra/cluster-config/example-secrets/slashdot-news/`).

Image rebuild after changing the scraper:

```bash
cd web-scrapers/slashdot-news-archive
docker build -t dwilson2547/slashdot-news-archive:latest .
docker push dwilson2547/slashdot-news-archive:latest
# pin the new digest in infra/cluster-config/slashdot-news/scraper.yaml, commit+push cluster_config
```

## Standalone use (from a shell with cluster network access)

```bash
pip install -r requirements.txt
# DATABASE_URL: postgresql URL with user slashdot_news, the secret's password, host
# postgres-pgvector.postgres.svc.cluster.local:5432, database slashdot_news
# (copy it from the slashdot-news-db secret; don't commit it)
export DATABASE_URL="$(kubectl -n slashdot-news get secret slashdot-news-db -o jsonpath='{.data.DATABASE_URL}' | base64 -d)"
export WEBCACHE_URL=http://webcache.scrape-stack.svc.cluster.local:8000
export REQUEST_AUTH_SERVER_URL=request-auth-server.scrape-stack.svc.cluster.local:9000

python3 scraper.py                          # daily incremental scrape (default command)
python3 scraper.py scrape --max-pages 10    # explicit; walks ?page=N until an all-known page
python3 scraper.py backfill --max-pages 200 # one-time deep history (default 5000 ≈ back to 2016)
python3 scraper.py embed --limit 500        # embed any stories missing embeddings
python3 scraper.py search "EU AI act" --limit 5                 # FTS
python3 scraper.py search "EU AI act" --semantic                # vector (pgvector cosine)
python3 scraper.py search "EU AI act" --hybrid                  # RRF merge of both
python3 scraper.py day 2026-11-05           # one day's stories as markdown
python3 scraper.py stats
```

`SLASHDOT_NO_STACK=1` bypasses webcache/request-auth (local testing / stack outage only).
From outside the cluster, `kubectl -n postgres port-forward postgres-pgvector-0 55432:5432`
makes the DB reachable at `127.0.0.1:55432`.

## How it works

- Strategy: **static HTML** — recon (2026-11-05, see `docs/recon-2026-11-05.md`) confirmed
  a plain `requests` GET returns the full article markup; no browser needed.
- `scrape` fetches page 0, then walks `?page=1,2,…` until a page yields zero new stories
  (the gap-fill), capped by `--max-pages`. `backfill` walks past the known frontier before
  applying that stop rule, for one-time deep fills. Both honor `SCRAPE_DEADLINE`.
- Every target request is check-before-fetch through **webcache** and wrapped in a
  **request-auth** permit (scrape-stack). robots.txt allows `/` and `/?page=N`; the
  Disallow-ed `/stories/` pages are never fetched — the full post text is on the listing page.
- Stories insert one at a time (incremental saves); each run is recorded in the `runs` table.

## Schema (Postgres, applied at startup)

- `stories` — `story_id` (PK, firehose id), `posted_at` (timestamptz UTC), `title`, `url`
  (unique), `slug`, `section`, `source_domain`, `source_url`, `author`, `dept`, `topic`,
  `comment_count`, `byline_time`, `body_text`, `body_html`, `page_seen`, `first_seen_at`,
  `scraped_at`, plus a generated `search_tsv` tsvector (GIN index) for FTS
- `story_embeddings` — `story_id` (PK, FK), `model`, `dim`, `embedding vector(384)`,
  `embedded_at`; HNSW index on `embedding vector_cosine_ops`
- `runs` — one row per run with pages/new/embedded counts and status

## Env vars

| Var | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | *(required)* | pgvector Postgres URL (from the `slashdot-news-db` secret in-cluster) |
| `WEBCACHE_URL` | `http://webcache.scrape-stack.svc.cluster.local:8000` | scrape-stack webcache |
| `REQUEST_AUTH_SERVER_URL` | `request-auth-server.scrape-stack.svc.cluster.local:9000` | scrape-stack request-auth (gRPC) |
| `CACHE_MAX_AGE_SECONDS` | `3600` | webcache freshness; daily runs always refetch |
| `EMBEDDING_MODEL` / `EMBEDDING_DIM` | `sentence-transformers/all-MiniLM-L6-v2` / `384` | in-pod embedder |
| `SCRAPE_DEADLINE` | — | RFC 3339 deadline injected by scrape-job-manager |
| `SLASHDOT_NO_STACK` | unset | `1` bypasses webcache/request-auth |

## Volume / egress

Daily run: 1 + up to `--max-pages` (default 10) requests to slashdot.org; typically 1–3 once
caught up. One-time deep backfill to 2016 is ~5000 requests (low-thousands one-shot band, fine
on the cluster egress; repeat pages come from webcache). All requests paced by request-auth.
