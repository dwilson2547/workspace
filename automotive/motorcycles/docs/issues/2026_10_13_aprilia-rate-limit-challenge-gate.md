# Aprilia catalogue rate-limit gate (reCAPTCHA "Verification Required") — 2026-10-13

## Symptom

The first prod aprilia run (20261013040255, before pacing was configured) went
Healthy with 48 items, but every displacement group after the first returned
"0 models", and 28 of the 48 diagrams were recorded with zero parts. The site
had silently served its rate-limit gate page with HTTP 200.

## Root cause

`aprilia.genuine-parts-catalogue.com` throttles per client IP and, once the
budget is spent, serves an interstitial page ("Verification Required",
Google reCAPTCHA form, `noindex`) instead of an HTTP 429. Observed threshold:
~400 requests per ~15 min rolling window — the dev run (~380 requests in 5 min
at request-auth's default 1 req/s) finished clean, and the prod run that
started 3 minutes later tripped the gate after ~30 requests. The block had
decayed ~20 minutes later. Image/asset URLs (`/assets/thumbs/...`) were still
served normally while catalogue pages were gated.

Because the gate is HTTP 200 HTML, nothing failed: the scraper parsed zero
links from it, cached it in webcache, and recorded empty diagrams.

## Fix (three layers)

1. **Pacing** — per-domain override in the request-auth DB (via the
   request-auth API, both `scrape-stack` and `scrapestack-dev` namespaces):
   `base_delay_ms: 15000` for `aprilia.genuine-parts-catalogue.com`. The rate
   lives in the request-auth DB, not in git — recreate it if the request-auth
   database is ever rebuilt:
   ```
   PATCH /api/domains/aprilia.genuine-parts-catalogue.com {"base_delay_ms": 15000}
   ```
2. **Detection** — the scraper recognizes the gate page
   (`CHALLENGE_MARKER = "Verification Required"`, checked on live fetches,
   cache hits, and image downloads), never caches it, deletes any poisoned
   webcache entry it finds, and aborts the run gracefully (partial result,
   exit 0, message `rate-limit challenge page — aborted run, resume next run`).
3. **Cleanup** — the poisoned state from the first run was removed:
   - 76 webcache entries (prod) deleted by content check; dev webcache and
     both imgcaches verified clean.
   - 28 empty diagrams deleted from `motorcycle_parts`, and the affected
     motorcycle's `scraped_at` reset so the next run re-walks the trim.

## Verification

- Dev run 20261013041311 (new image): 18 diagrams re-scraped at the new
  ~16 s pacing, previously-poisoned ENGINE diagrams parsed with real parts,
  graceful deadline exit.
- Prod run 20261013041952: 9 diagrams, Healthy, same recovery confirmed.

## Notes for other OEM scrapers

Any target site that returns 200 with an interstitial instead of 429 can
poison webcache and the DB the same way. Cheap insurance: detect a marker of
the interstitial on every fetch path and treat it as a hard stop, and verify
"0 items parsed" results rather than trusting them (a diagram with 0 parts
was the tell here).
