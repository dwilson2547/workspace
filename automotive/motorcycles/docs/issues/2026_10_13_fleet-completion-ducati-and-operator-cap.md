# Fleet completion: ducati + operator concurrency cap — 2026-10-13

The last motorcycle scraper (ducati) went live, completing the six-OEM fleet.
Two operational findings from this session are recorded here because they
affect every future fleet deployment.

## The "operator stall" was the concurrency cap

Symptom: run-now annotations sat undistributed for hours; the operator log
went silent for long stretches after dispatching exactly one run. This
matched the "operator stall (unroot-caused)" note from the first fleet
rollout — but the operator was healthy the whole time: it was pinned at
`maxConcurrentRuns=6`, with four 8h motorcycle backfills plus gyopart's runs
holding every slot. Queued manual requests dispatch silently when a slot
frees.

Fix: `maxConcurrentRuns` bumped to 10 in the scrape-job-manager repo
(`helm/scrape-job-manager/values-prod.yaml`) — the expanded fleet (six OEM
scrapers with multi-hour backfills + gyopart) outgrew 6.

**Lesson:** before suspecting an operator stall, count active k8s jobs across
namespaces against the cap. A silent operator with pending run-now requests
is usually just full.

## Concurrent dev/prod runs race on diagram inserts

A suzuki run-now request queued behind the cap for ~20 minutes, then
dispatched into the dev namespace *after* the prod run had started — two pods
scraping the same diagrams concurrently. The prod run died on
`uq_diagram_url` (its INSERT collided with the dev pod's row, committed
seconds earlier). The dev run then carried the backfill for 8h (234
diagrams).

Fixes:
- suzuki's diagram insert is race-safe: `IntegrityError` → rollback, re-query,
  adopt the existing row (re-persisting the rolled-back image row via the
  imgcache lookup).
- The other five scrapers keep the plain upsert — the operational rule
  (suspend the dev job once prod is verified) prevents the overlap, and
  these scrapers were not changed.

**Lesson:** a queued run-now is a live request — it can fire long after you
forgot it, into whatever the manifest says then (dev timeouts had been
restored to 8h by then, so it ran for hours). Suspend the dev job (or clear
the annotation) before moving on.

## Ducati-specific notes

- Two image bugs caught by the dev run: `lxml` missing from requirements
  (BeautifulSoup parser), and the motorcycle↔diagram link never written
  (`diagram.motorcycles.append(moto)` omitted) — 74 orphaned diagrams
  backfilled via SQL (`INSERT INTO motorcycle_diagrams ... JOIN ON
  source_url LIKE '%/' || variant_key || '/%'`).
- The SVG parser (`ducati/svg_parse.py`) validated against all three
  catalogue eras locally before deployment: 2003 scan (OCR layer), 2011
  born-digital, 2026 born-digital with 9-char alphanumeric codes and
  qty+validity fused tokens.
