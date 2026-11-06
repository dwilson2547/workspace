# Deployment: scrape-job-manager daily job + cluster pgvector — 2026-11-06

Status: **live and verified** (ScrapeJob `slashdot-news/slashdot-news` Healthy after manual run
20261106015817, items=2; backfill/embed/search verified via one-off pods in the same namespace).

## Pieces

| Piece | Where |
|---|---|
| Scraper code | `web-scrapers/slashdot-news-archive/` (this dir), image `dwilson2547/slashdot-news-archive` pinned by digest |
| CRs (Scraper/ScrapeJob/ScrapePool/namespace) | `infra/cluster-config/slashdot-news/` (cluster_config repo), synced by ArgoCD app `slashdot-news` |
| Schedule | ScrapePool `every: 1d`, activeHours 06:00–08:00 America/New_York, all days |
| DB | `slashdot_news` on `postgres-pgvector-0` (svc `postgres-pgvector.postgres.svc.cluster.local:5432`), `vector` ext; init: `infra/cluster-config/postgres/init-slashdot-news.sql` (force-added; `**/init-*.sql` is gitignored, password passed via psql var) |
| DB credentials | Secret `slashdot-news-db` in ns `slashdot-news` (template: `example-secrets/slashdot-news/secret.yml` — literal URLs trip the credential guard, use the `CHANGE_ME_DATABASE_URL` placeholder convention) |
| Cache / permits | `webcache.scrape-stack.svc.cluster.local:8000`, `request-auth-server.scrape-stack.svc.cluster.local:9000` (in-cluster names; from a shell use `*.scrapestack.local` port 80 / :9000) |
| Embeddings | in-pod sentence-transformers all-MiniLM-L6-v2 (384-dim), model baked into image at build (`HF_HOME=/model`). **Not** the danwiki embedding service (per user). New stories auto-embedded at end of scrape; `embed` command for catch-up |

## Gotchas hit

- Bare `python3 scraper.py` (what the operator runs) must accept the scrape flags at top level —
  subparser-only args caused `AttributeError: 'Namespace' object has no attribute 'max_pages'`
  (exit 65 → job Degraded, one notification email). Fixed with top-level flags + SUPPRESS subparser defaults.
- Manual `run-now` while a previous run failed is rate-limited by the Scraper `spacing.min` (10m)
  since `lastStartedAt` — annotations are handled immediately but the dispatch waits out the gap.
- Cluster Postgres is not reachable from the WSL box directly; for shell-side testing use
  `kubectl -n postgres port-forward postgres-pgvector-0 55432:5432` (and `SLASHDOT_NO_STACK=1`
  because the in-cluster service DNS names don't resolve off-cluster).
- `webcache.scrape-stack.svc.cluster.local:8000` (in-cluster) and `webcache.scrapestack.local:80`
  (off-cluster) are different front doors; cache entries don't cross them.
- Embedding model in the image prints an unauthenticated-HF-hub warning but loads from the baked
  `/model` cache; ~1.5 s for 60 stories on CPU.

## Verified in-cluster (2026-11-06)

- `scrape` via run-now: pages via webcache+request-auth, gap-fill stop, result payload
  `{"items":2,"new":0,...}`, job phase Degraded→Healthy.
- `backfill --max-pages 5`: walked past known frontier (pages 0–3), new=30, embedded=30.
- `embed --limit 100`: 60 stories embedded.
- `search "EU court copyright AI chatbot google" --semantic`: top hit = the EU-court/Google
  story (cosine 0.727).
