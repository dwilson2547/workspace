# aprilia

Aprilia OEM parts diagrams — https://aprilia.genuine-parts-catalogue.com

Server-rendered catalogue (no browser needed): the URL hierarchy
displacement → model → year → trim lists its children as links on each page,
and the trim page groups the diagram cards by category accordion. Selector
recon is in `scraper.py`'s header. The site was redesigned since the original
Playwright-based scraper was written; every level is now plain HTML.

## Running under scrape-job-manager

Part of the motorcycle parts reference system (`motorcycle_common` schema →
shared `motorcycle_parts` Postgres). Release status: [`../RELEASES.md`](../RELEASES.md).

- **Contract** — `scrape_contract.run` wraps `main()`; exit codes 0 / 75 / 65;
  result payload `{\"items\": diagrams_scraped, \"new\": parts_new, …}`.
  Honors the operator-injected `SCRAPE_DEADLINE` (stops gracefully at the end
  of the active-hours window).
- **Image** — `Dockerfile` (build context `automotive/motorcycles/`, copies
  `scrape_contract.py` + `motorcycle_common/`), pushed as
  `dwilson2547/motorcycle-scraper-aprilia`, pinned by digest in
  `infra/cluster-config/motorcycles/{dev,prod}/aprilia.yaml`:
  ```bash
  cd automotive/motorcycles
  docker build -f aprilia/Dockerfile -t dwilson2547/motorcycle-scraper-aprilia:latest .
  docker push dwilson2547/motorcycle-scraper-aprilia:latest
  # then update the digest in both manifests + commit
  ```
- **Schedule** — ScrapePool `motorcycle-parts` (weekly, Mon–Fri 09:00–19:00
  America/New_York). Full-catalogue backfill spans many runs: progress is
  resume-safe (`scraped_at`), each run continues where the previous stopped.

## Rate limiting

The catalogue throttles per IP (~400 requests per ~15 min, observed 2026-10-13)
and answers with a reCAPTCHA "Verification Required" page — HTTP 200, not a
429 — once the budget is spent. Two consequences:

- request-auth paces `aprilia.genuine-parts-catalogue.com` at 1 req/15s. The
  override lives in the request-auth DB (set via the request-auth API in both
  the `scrape-stack` and `scrapestack-dev` namespaces) — not in this repo.
- The scraper detects the challenge page, deletes any poisoned webcache entry
  it finds, and aborts the run gracefully (exit 0, partial result); the next
  run resumes from `scraped_at`. Never parsed, never cached.

A full-catalogue backfill (~15.6k diagrams per the site sitemaps, ≈36k
requests) takes many weekly 8h runs at this pacing; accelerate with a run-now
annotation (each run stays well under the site's budget on its own, so avoid
running dev and prod jobs at the same time).

## Environment

| Variable | Meaning |
|---|---|
| `MOTORCYCLE_DATABASE_URL` | shared motorcycle_parts Postgres (required) |
| `WEBCACHE_URL` / `IMGCACHE_URL` | scrape-stack cache services |
| `REQUEST_AUTH_SERVER_URL` | request-auth permit server (pacing: default 1 req/s/domain) |
| `SCRAPE_DEADLINE` | injected by the operator; graceful stop |

## Data notes

- One callout index can list several part numbers (colour/variant options);
  one part number can appear at several indices — those collapse to a single
  `DiagramPart` row whose `extras.ref_nums` carries every index.
- `quantity` is not exposed by the current site design (stored as NULL).
- `extras` also carries `price` (site currency, locale-dependent),
  `available`, and `superseded` (line-through reference).

## History

The original version was Playwright-based with local sleep pacing, images on
disk, and a private SQLite schema (`db.py`); it was converted to the shared
schema + scrape-stack clients on 2026-10-12 after a site recon found every
level server-rendered. The original prompt-style readme is preserved in git
history.
