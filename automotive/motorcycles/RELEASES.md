# Motorcycle scraper release status

Where each motorcycle parts scraper runs under scrape-job-manager. Tick **Dev**
when a run has succeeded in `motorcycles-dev` (`infra/cluster-config/motorcycles/dev/`)
and the rows were checked in the `motorcycle_parts` DB; tick **Prod** when the job
is live in `motorcycles/prod/` and a prod run has succeeded. Once a scraper is in
prod its dev job is `suspend: true` (no duplicate traffic); run-now it in dev to
test a change first. Getting a scraper ready for the operator (contract, image,
schedule) is in `kawasaki/readme.md` § Running under scrape-job-manager.

All OEM scrapers write the same `motorcycle_parts` database through
`motorcycle_common/` — the reference catalogue is cumulative across OEMs.

| Scraper | Source | Browser needed | Dev | Prod | Notes |
|---------|--------|:--------------:|:---:|:----:|-------|
| `kawasaki/` | kawasaki.com owner-center | no | [x] | [x] | Prod since 2026-10-13 (run 20261013032847: 211 diagrams). Dev verified 2026-10-13 (100 diagrams), then suspended |
| `harley/` | harley-davidson.com (ARI PartStream API) | no | [ ] | [ ] | Not yet converted to the shared schema |
| `yamaha/` | yamahamotor.com/parts | JWT bootstrap | [ ] | [ ] | Not yet converted |
| `aprilia/` | aprilia genuine-parts-catalogue | no | [x] | [x] | Prod since 2026-10-13 (run 20261013041952 with challenge detection: 9 diagrams, Healthy). Dev verified (18 diagrams), then suspended. Site throttles per IP and serves a reCAPTCHA gate page — request-auth paces it at 1 req/15s; see `aprilia/readme.md` § Rate limiting |
| `suzuki/` | suzukipartshouse.com | yes | [ ] | [ ] | Not yet converted |
| `ducati/` | ducatiomaha.com Issuu catalogues → pdfplumber | yes | [ ] | [ ] | Two-stage pipeline, Postgres |

Manual scrapers (document downloaders, not part of the interchange fleet):
`honda/` (hondamotopub.com owner's manuals), `ducati_owners_manuals/`
(ducati.com all-in-one OM/SPC/maintenance PDFs).
