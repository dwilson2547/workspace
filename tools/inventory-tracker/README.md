# inventory-tracker

An AI-assisted **purchase + inventory tracker**. Point it at a vendor receipt and
it builds a structured, queryable inventory of the parts and tools you own —
each enriched with parametrics and a locally cached datasheet/manual — so agents
can navigate your specific components and suggest alternatives you already have.

First ingestion pipeline is DigiKey component invoices; the storage model is
general enough to hold tools, manuals, and other purchases too.

## Design in one breath

- **Deterministic where it can be, AI where it must be.** A regular invoice is
  parsed by code; the DigiKey API supplies parametrics + datasheet URLs; an agent
  with Playwright is the *fallback* that hunts down datasheets the API doesn't
  have. See [`docs/data-model.md`](docs/data-model.md) for the storage layer.
- **One record envelope, a typed `params` block, a schema registry that validates
  on write** — so heterogeneous items (resistors → chargers) never turn `params`
  into a swamp of inconsistent tags.
- **Files are the source of truth**, SQLite is a rebuildable index, the CLI owns
  both.

## CLI

```
inv ingest <pdf> [--dry-run]     # parse a DigiKey invoice -> order + item stubs
inv enrich [--all --refresh]     # DigiKey API: category, params, datasheet URL
inv fetch [--refresh]            # download datasheets into store/docs/ (dedup by sha256)
inv search --category C 'k>=v'   # parametric search (ranges + ~ substring)
inv alt <id>                     # alternatives you already own
inv schema list | show <c> | pending    # inspect schemas / provisional review queue
inv validate <f> | add <f> | show <id> | find <q>
inv reindex                      # rebuild inventory.db from files
inv export md                    # generate views/parts.md
```

Pipeline: `ingest` lands parts in the `unclassified` category (core fields +
purchase record); `enrich` assigns the real category + `params` and records the
datasheet URL; `fetch` downloads the PDFs. Curated categories get clean numeric
params; the rest auto-provision from DigiKey's taxonomy (`inv schema pending`).
Remaining stub: `enrich`/`fetch` misses feed the slice-5 Playwright fallback.

Run in place with `python3 -m inv …`, or `pip install -e .` for the `inv` command.
Requires Python 3.10+ and PyYAML.

## Status

Core pipeline complete (slices 1–6), verified against a real 42-part inventory
across 4 orders: schema model, DigiKey invoice parser, API enrichment, datasheet
cache with browser-UA + interstitial fallback, and parametric search/alternatives.
**40/42 datasheets cached** (2 gaps documented: 1 IP-blocked vendor, 1 with no
DigiKey URL). Remaining: the `inventory-ingest` skill, productizing the browser
fallback (playwright-python), and curating provisional schemas. See
[`TODO.md`](TODO.md).
