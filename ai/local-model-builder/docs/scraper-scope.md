# Scope: new scraper sites through local models

Status: **scoped 2026-11-02, parked** (other work first). Nothing below is built.

## Why scrapers

The shelf runs (`results.md`) showed the planning is most of the work: spec, task cards and tests took more effort
than the code. Local models pay off only where one plan serves many executions. Scrapers fit: the gyopart yard
scrapers (`automotive/gyopart/junkyard-inventory-scrapers/`, 19 built per `SCRAPERS.md`) fall into six platform
groups (URG IIS Pro v2, simple SSR tables, CSV/XML feeds, REST/JSON APIs, WordPress admin-ajax, special), and
within a group a new site is the same crawl with different constants and parsing. Each is ~330–440 lines
(`speedwayap/scraper.py` 437, `wrenchapart/scraper.py` 331), most of it shared shape: fetch, parse cards, upsert
through `junkyard_common`.

## Shape of the pipeline

1. **Recon** (outside the local-model loop): classify the site into a platform group and save fixture pages
   (HTML/JSON responses for a make list, a model page, an inventory page, latest arrivals). Bonsai driving
   Playwright is a candidate here (the user found it good at opening and reading pages); otherwise the existing
   recon playbook (`junkyard-platform/pipeline/scraper_creation_notes/junkyard_site_recon_playbook.md`) by hand.
2. **Plan** per platform group, written once: a template scraper split so the site-specific part is a separate
   module of **pure functions** (page text → records: `parse_makes`, `parse_models`, `parse_vehicle_cards`, …) plus
   a constants block (`SOURCE`, locations, URLs). The crawl, DB writes and run bookkeeping stay in the template.
3. **Tasks**, one file and one function group per task (shelf finding: multi-file tasks fail): constants, then each
   parse function, each tested offline against the fixtures.
4. **Tests from fixtures**: expected records for each fixture page. For a site that already has a scraper, run its
   current parser over the fixtures to get them; for a new site, a reviewer (or a bigger model, checked) labels a
   handful of vehicles per page.
5. **Sandbox**: the existing harness as is: tests run offline in `docker --network none` against fixtures.
6. **Live check** (outside the loop): one real run through scrape-stack (cache, rate limits, VPN egress) in a
   test namespace, compared with the site's own counts, before it goes into `SCRAPERS.md` and the operator.

## First experiment

Re-derive scrapers that already exist, so ground truth is free:

- Pick group 1 (URG IIS Pro v2): several built sites with one documented pattern (`notes/urg-iis-pro-v2-platform.md`).
- Save fixtures for 3–4 of its sites; generate expected records with each site's current parser.
- Write the group's template and task cards once; hide each site's scraper and run its tasks through
  `qwen35-9b` (then Gemma / Bonsai on the failures).
- Measure per site: tasks passed, attempts, records matching the existing scraper's output.

Go/no-go: if most sites in the group come out matching with little review, extend to the other groups and to new
yards; if not, record why and stop.

## Before starting

- Sampling on retries in gpu-scheduler's llama.cpp adapter (shelf: greedy retries repeat the same wrong answer).
- Escalation to a second model after the first failure, in the harness.
- Current scrapers have no fixture tests (no `tests/` per scraper as of 2026-11-02); saving fixtures is new work.
