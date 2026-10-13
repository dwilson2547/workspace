# Fleet rollout: harley, yamaha, suzuki — 2026-10-13

Three scrapers converted to the shared `motorcycle_common` schema and deployed
under scrape-job-manager in one session. Per-OEM notes live in each readme;
this doc records the cross-cutting gotchas.

## Harley — ARI PartStream API moved

The JSONP endpoints moved under the `/Parts/` path prefix
(`/Parts/GetAssembly`, `/Parts/GetDetails`); the bare paths the old scraper
used still return HTTP 200 with an **empty body** — silent, not an error.
The response shape also changed: items are under `{"model": {"json": [...]}}`,
and GetDetails returns `li.ariPartInfo` div rows (with `tag`/`partid` attrs,
`.ariPartNumber`, `.ariPLDesc`, `.ariPLPrice[price]`, qty input) instead of the
old `<tr>` table. Diagram images: `cdn.datamanager.arinet.com` (separate
request-auth domain from `partstream.arinet.com`).

**Lesson:** a 200-with-empty-body API drift is invisible to status-code checks —
enumerate-then-count sanity checks (Broken on zero results) are what catch it.

## Yamaha — browser-free now, but the API is sparse

The old flow used Playwright only to sniff the anonymous JWT from page
headers. Recon found the token is just `POST https://api.yamaha-motor.com/auth`
(no body, ~3 h validity); the old POC API host now resolves to **private IPs**
and is unreachable. The catalogue itself only has parts data for a *subset* of
diagrams: several years 404 at the models endpoint (skip without retries —
retrying burns 60 s per empty year), and many diagrams return an empty
fallback (title pages, most 2024+ models). Recording those would poison the DB
with 0-part diagrams — they are skipped instead, and models whose walk
completes are marked done; reset `scraped_at` if Yamaha publishes more later.

**Lesson:** before recording "empty" results, verify the endpoint's negative
shape (404 vs empty-list vs empty-props) — each needs different handling.

## Suzuki — Cloudflare managed challenge

`suzukipartshouse.com` challenges *every* path (robots.txt included); plain
requests and plain headless Chromium (browserless) both fail. `playwright-stealth`
passes it **intermittently**: most navigations clear instantly, some get a
challenge that never auto-solves within 60 s — locally and in-cluster alike.
The scraper retries each stuck page with a fresh page (new fingerprint), skips
pages that stay stuck, and only aborts a run after 5 consecutive stuck pages.
Image/asset URLs (`media.vxt.production.ldv-svcs.live`) are NOT challenged.
request-auth paces the domain at 1 req/30s (the old robots.txt crawl-delay was
10 s; the original readme asked for 30 s minimum).

**Lesson:** challenge pass/fail is probabilistic — design for skip-and-resume,
not for guaranteed access. webcache makes re-checking skipped pages cheap.

## Operational notes

- request-auth per-domain overrides used (via the request-auth API, both
  namespaces — lives in the request-auth DB, not git):
  `aprilia.genuine-parts-catalogue.com` 15 s, `www.suzukipartshouse.com` 30 s.
- The motorcycle fleet now runs five OEMs into one shared `motorcycle_parts`
  Postgres; all dev jobs are `suspend: true` (prod owns the schedule).
- The k8s job `DeadlineExceeded` + pod deletion removes logs of a timed-out
  run — check the operator log + `scrapejob.status` for post-mortem.
