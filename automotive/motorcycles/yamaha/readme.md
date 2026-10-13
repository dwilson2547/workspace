# yamaha

Yamaha OEM parts — https://yamaha-motor.com/parts

Browser-free since the 2026 site redesign: an anonymous service token
(`POST https://api.yamaha-motor.com/auth`, no body, ~3 h validity) unlocks the
legacy browse API, and the diagram/parts data comes from Next.js `_next/data`
JSON endpoints. The diagram JSON embeds the diagram image as a base64 PNG data
URI, so images come free with the parts call. Endpoint recon is in
`scraper.py`'s header.

(The old per-IP POC API host `yamaha-api-poc-main.prod.yamaha-motor.com` now
resolves to private addresses and is unreachable from outside Yamaha.)

## Running under scrape-job-manager

Part of the motorcycle parts reference system (`motorcycle_common` schema →
shared `motorcycle_parts` Postgres). Release status: [`../RELEASES.md`](../RELEASES.md).

- **Contract** — `scrape_contract.run` wraps `main()`; exit codes 0 / 75 / 65;
  result payload `{"items": diagrams_scraped, "new": parts_new, …}`.
  Honors the operator-injected `SCRAPE_DEADLINE`.
- **Image** — `Dockerfile` (build context `automotive/motorcycles/`), pushed as
  `dwilson2547/motorcycle-scraper-yamaha`, pinned by digest in
  `infra/cluster-config/motorcycles/{dev,prod}/yamaha.yaml`:
  ```bash
  cd automotive/motorcycles
  docker build -f yamaha/Dockerfile -t dwilson2547/motorcycle-scraper-yamaha:latest .
  docker push dwilson2547/motorcycle-scraper-yamaha:latest
  # then update the digest in both manifests + commit
  ```
- **Schedule** — ScrapePool `motorcycle-parts` (weekly, Mon–Fri 09:00–19:00
  America/New_York). All JSON responses go through webcache (keyed by URL), so
  re-runs are cheap; the backfill is resume-safe (`scraped_at`).

## Environment

| Variable | Meaning |
|---|---|
| `MOTORCYCLE_DATABASE_URL` | shared motorcycle_parts Postgres (required) |
| `WEBCACHE_URL` / `IMGCACHE_URL` | scrape-stack cache services |
| `REQUEST_AUTH_SERVER_URL` | request-auth permit server (pacing) |
| `SCRAPE_DEADLINE` | injected by the operator; graceful stop |

## Data notes

- Model identity: the catalogue model id is the `variant_key`. Labels like
  `FZ09ECGY (FZ09 CA) 1RC5 2014` parse into model code / model name / trim
  (frame) code / year.
- The legacy API only has parts data for a subset of diagrams — several years
  404 at the models endpoint, and many diagrams (title pages, most 2024+
  models) return an empty fallback. Diagrams without items are skipped, not
  recorded; models whose catalogue has no diagrams at all are marked scraped
  so they aren't re-walked. If Yamaha publishes more later, the affected
  motorcycles' `scraped_at` can be reset to re-walk them.
- Diagrams have no grouping in this catalogue — `category_id` stays NULL and
  the diagram name (e.g. `AIR INDUCTION SYSTEM`) is the title.
- DiagramPart `extras` carries `display_part_number` (dashed form) and
  `price` (listPrice when present); `quantity` is the OEM callout qty.

## History

The original version used Playwright solely to capture the anonymous JWT from
page request headers, plus a local lz4 file cache and private SQLite schema.
The 2026-10-13 recon found the plain `POST /auth` token endpoint, so the
browser is gone entirely. The original prompt-style readme is preserved in
git history.
