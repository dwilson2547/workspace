# harley

Harley-Davidson OEM service parts — via the ARI PartStream JSONP API that
powers harley-davidson.com's parts widget.

No browser, no site session: plain JSONP calls to `partstream.arinet.com`
(GetAssembly for the tree, GetDetails for each assembly). Endpoint recon and
response shapes are in `scraper.py`'s header — notably the API moved under the
`/Parts/` path prefix and GetDetails now returns `li.ariPartInfo` div rows
instead of the old `<tr>` table.

## Running under scrape-job-manager

Part of the motorcycle parts reference system (`motorcycle_common` schema →
shared `motorcycle_parts` Postgres). Release status: [`../RELEASES.md`](../RELEASES.md).

- **Contract** — `scrape_contract.run` wraps `main()`; exit codes 0 / 75 / 65;
  result payload `{"items": diagrams_scraped, "new": parts_new, …}`.
  Honors the operator-injected `SCRAPE_DEADLINE`.
- **Image** — `Dockerfile` (build context `automotive/motorcycles/`), pushed as
  `dwilson2547/motorcycle-scraper-harley`, pinned by digest in
  `infra/cluster-config/motorcycles/{dev,prod}/harley.yaml`:
  ```bash
  cd automotive/motorcycles
  docker build -f harley/Dockerfile -t dwilson2547/motorcycle-scraper-harley:latest .
  docker push dwilson2547/motorcycle-scraper-harley:latest
  # then update the digest in both manifests + commit
  ```
- **Schedule** — ScrapePool `motorcycle-parts` (weekly, Mon–Fri 09:00–19:00
  America/New_York). API responses are cached in webcache (full URL incl.
  query), so re-runs are cheap and the backfill is resume-safe (`scraped_at`).

## Environment

| Variable | Meaning |
|---|---|
| `MOTORCYCLE_DATABASE_URL` | shared motorcycle_parts Postgres (required) |
| `WEBCACHE_URL` / `IMGCACHE_URL` | scrape-stack cache services |
| `REQUEST_AUTH_SERVER_URL` | request-auth permit server (pacing) |
| `SCRAPE_DEADLINE` | injected by the operator; graceful stop |

## Data notes

- Model identity: each PartStream folder node has a unique `aria` id — that is
  the `variant_key`. Labels like `FLFBS 1YGK FAT BOY 114 (2024)` are parsed into
  model code / trim code / model name / year.
- The model category (SOFTAIL, TOURING, …) becomes `PartCategory` for the
  model's diagrams, and the assembly name (AIR CLEANER, …) is the diagram title.
- Diagram `source_url` is the GetDetails API URL for the assembly — the
  canonical unique key for a diagram in the shared schema.
- DiagramPart `extras` carries the ARI-reported `price`; `quantity` is the
  default order quantity from the parts list when present.

## History

The original version wrote a private SQLite schema with local sleep pacing and a
backoff.json 429 handler; it was converted to the shared schema + scrape-stack
clients on 2026-10-13, after recon found the API endpoints had moved under
`/Parts/`. The original prompt-style readme is preserved in git history.
