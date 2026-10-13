# suzuki

Suzuki OEM parts — https://www.suzukipartshouse.com (Babbitt's Suzuki Parts House)

The only scraper in the motorcycle fleet that ships a browser: the site sits
behind a Cloudflare managed challenge that blocks plain requests and plain
headless Chromium. `playwright-stealth` passes it, so the image contains
Chromium and every page render happens locally. Renders only fire on webcache
misses; a challenge that does not clear within 40 s aborts the run gracefully
(partial result, exit 0) and the next run resumes.

URL hierarchy and SELECTORS (all still matching the 2026-10-13 recon) are in
`scraper.py`'s header. Diagram images come from Babbitt's media CDN
(`media.vxt.production.ldv-svcs.live`), which is not challenged — they are
downloaded with plain httpx under a permit.

## Running under scrape-job-manager

Part of the motorcycle parts reference system (`motorcycle_common` schema →
shared `motorcycle_parts` Postgres). Release status: [`../RELEASES.md`](../RELEASES.md).

- **Contract** — `scrape_contract.run` wraps `main()`; exit codes 0 / 75 / 65;
  result payload `{"items": diagrams_scraped, "new": parts_new, …}`.
  Honors the operator-injected `SCRAPE_DEADLINE`.
- **Image** — `Dockerfile` (build context `automotive/motorcycles/`, installs
  Chromium via `playwright install --with-deps`), pushed as
  `dwilson2547/motorcycle-scraper-suzuki`, pinned by digest in
  `infra/cluster-config/motorcycles/{dev,prod}/suzuki.yaml`:
  ```bash
  cd automotive/motorcycles
  docker build -f suzuki/Dockerfile -t dwilson2547/motorcycle-scraper-suzuki:latest .
  docker push dwilson2547/motorcycle-scraper-suzuki:latest
  # then update the digest in both manifests + commit
  ```
- **Schedule** — ScrapePool `motorcycle-parts` (weekly, Mon–Fri 09:00–19:00
  America/New_York). request-auth paces `www.suzukipartshouse.com` at
  1 req/30s (set via the request-auth API — the site's robots.txt is itself
  behind the Cloudflare challenge; the old crawl-delay was 10s and the original
  readme asked for 30s minimum). The full catalogue takes many weekly runs.

## Environment

| Variable | Meaning |
|---|---|
| `MOTORCYCLE_DATABASE_URL` | shared motorcycle_parts Postgres (required) |
| `WEBCACHE_URL` / `IMGCACHE_URL` | scrape-stack cache services |
| `REQUEST_AUTH_SERVER_URL` | request-auth permit server (pacing) |
| `SCRAPE_DEADLINE` | injected by the operator; graceful stop |

## Data notes

- Model identity: the hex model id from the URL
  (`/oemparts/l/suz/{id}/…`) is the `variant_key`; the model page h1 gives
  the display name.
- Diagrams are listed flat per model (no grouping) — `category_id` stays NULL.
- DiagramPart `extras` carries `price` and the Babbitt's `part_url`;
  `quantity` is the OEM callout qty when present.

## History

The original version ran Playwright locally with sleep-based pacing (30–45 s),
a backoff.json 429 handler, and a private SQLite schema; converted to the
shared schema + scrape-stack clients on 2026-10-13, adding
`playwright-stealth` because plain headless Chromium stopped passing the
Cloudflare challenge. The original prompt-style readme is preserved in git
history.
