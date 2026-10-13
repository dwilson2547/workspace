# ducati

Ducati OEM parts — via the catalogues Ducati Omaha republishes on Issuu
(https://www.ducatiomaha.com/pages/ducati-oem-parts).

No browser, no PDFs, no OCR: Issuu renders every catalogue page as an SVG
with a positioned text layer — the original vector text for born-digital
catalogues, and Issuu's own OCR layer for scans. Both "standards" parse with
the same code (`svg_parse.py`); the only difference is word encoding (one
element per word vs one per glyph).

```
ducatiomaha.com index page (static HTML, 598 catalogues)
  → reader3.isu.pub/{user}/{slug}/reader4.json   (page list; svgUrl per page)
  → svg.issuu.com/{revision}-{pub}/page_N.svg      (per-page vector render)
```

Catalogue pages are sequential: contents pages are skipped, a drawing page
("DRAWING {code}") carries the subsystem image, and its table pages carry the
part rows (callout | code | description | qty). A drawing is marked complete
when the next code appears, so multi-page tables accumulate. Tables may sit
side-by-side in two column groups; rows are split on the groups' CODE anchors.

## Running under scrape-job-manager

Part of the motorcycle parts reference system (`motorcycle_common` schema →
shared `motorcycle_parts` Postgres). Release status: [`../RELEASES.md`](../RELEASES.md).

- **Contract** — `scrape_contract.run` wraps `main()`; exit codes 0 / 75 / 65;
  result payload `{"items": tables_parsed, "new": parts_new, …}`.
  Honors the operator-injected `SCRAPE_DEADLINE`.
- **Image** — `Dockerfile` (build context `automotive/motorcycles/`), pushed as
  `dwilson2547/motorcycle-scraper-ducati`, pinned by digest in
  `infra/cluster-config/motorcycles/{dev,prod}/ducati.yaml`:
  ```bash
  cd automotive/motorcycles
  docker build -f ducati/Dockerfile -t dwilson2547/motorcycle-scraper-ducati:latest .
  docker push dwilson2547/motorcycle-scraper-ducati:latest
  # then update the digest in both manifests + commit
  ```
- **Schedule** — ScrapePool `motorcycle-parts` (weekly, Mon–Fri 09:00–19:00
  America/New_York). reader4.json and page SVGs go through webcache (re-runs
  are nearly free); progress is resume-safe (`scraped_at` per diagram, catalogue
  slug as the motorcycle variant key). ~70k pages across 598 catalogues —
  roughly a week of pool runs at default pacing.

## Environment

| Variable | Meaning |
|---|---|
| `MOTORCYCLE_DATABASE_URL` | shared motorcycle_parts Postgres (required) |
| `WEBCACHE_URL` / `IMGCACHE_URL` | scrape-stack cache services |
| `REQUEST_AUTH_SERVER_URL` | request-auth permit server (pacing) |
| `SCRAPE_DEADLINE` | injected by the operator; graceful stop |

## Data notes

- Catalogue identity: the Issuu slug is the `variant_key`; year/model come
  from the link title ("Ducati Omaha 2026 OEM Ducati Diavel V4 …"), with
  slug-derived fallbacks. Catalogues without a derivable year get "unknown".
- Part codes span eras: dotted (`88765.1236`, pre-2016) and 9-char
  alphanumeric (`5101I231D`, 2016+). Both match the same parser.
- DiagramPart `extras` carries the table's `notes` (market codes like I/GB/D),
  `validity` tokens, and `ref_nums` (all callouts for that part — Ducati tables
  list one part at several callouts; rows collapse by code with the first
  callout as `ref_num`); `qty` is stored only when unambiguous (single-digit
  token — the 2016+ tables fuse qty+validity into one run).
- Subsystem images are the rasterized drawing pages, stored via imgcache.
  Born-digital catalogues carry their own raster; scans are the page JPEG.

## History / future

The original two-stage pipeline (Playwright → Issuu download button → PDF;
pdfplumber for text PDFs; per-page SVG downloads for the rest) was replaced
on 2026-10-13 by the SVG path after recon found the reader API is plain HTTP
and both standards carry a parseable text layer. The old code is preserved in
git history.

Future (non-blocking): archival downloads of the original PDFs for the
records — the old download-button flow, kept as a separate one-off rather than
part of the fleet scraper.
