# kawasaki

Kawasaki OEM parts diagrams — https://www.kawasaki.com/en-us/owner-center/parts

Server-rendered site (no browser needed): two JSON AJAX endpoints enumerate
category → years → model codes, then two HTML page shapes give the diagram list
and the per-diagram parts table (selector recon in `scraper.py` header).

## Running under scrape-job-manager

Part of the motorcycle parts reference system (`motorcycle_common` schema →
shared `motorcycle_parts` Postgres). Release status: [`../RELEASES.md`](../RELEASES.md).

- **Contract** — `scrape_contract.run` wraps `main()`; exit codes 0 / 75 / 65;
  result payload `{"items": diagrams_scraped, "new": parts_new, …}`.
  Honors the operator-injected `SCRAPE_DEADLINE` (stops gracefully at the end
  of the active-hours window).
- **Image** — `Dockerfile` (build context `automotive/motorcycles/`, copies
  `scrape_contract.py` + `motorcycle_common/`), pushed as
  `dwilson2547/motorcycle-scraper-kawasaki`, pinned by digest in
  `infra/cluster-config/motorcycles/{dev,prod}/kawasaki.yaml`:
  ```bash
  cd automotive/motorcycles
  docker build -f kawasaki/Dockerfile -t dwilson2547/motorcycle-scraper-kawasaki:latest .
  docker push dwilson2547/motorcycle-scraper-kawasaki:latest
  # then update the digest in both manifests + commit
  ```
- **Schedule** — ScrapePool `motorcycle-parts` (weekly, Mon–Fri 09:00–19:00
  America/New_York). Full-catalogue backfill spans many runs: progress is
  resume-safe (`scraped_at`), each run continues where the previous stopped.

## Environment

| Variable | Meaning |
|---|---|
| `MOTORCYCLE_DATABASE_URL` | shared motorcycle_parts Postgres (required) |
| `WEBCACHE_URL` / `IMGCACHE_URL` | scrape-stack cache services |
| `REQUEST_AUTH_SERVER_URL` | request-auth permit server (pacing: default 1 req/s/domain) |
| `SCRAPE_DEADLINE` | injected by the operator; graceful stop |

## History

The original version scraped to a local SQLite file with local sleep-based
pacing and images on disk; it was converted to the shared schema + scrape-stack
clients on 2026-10-12 (see `../motorcycle_common/models.py`). The original
prompt-style readme is preserved in git history.
