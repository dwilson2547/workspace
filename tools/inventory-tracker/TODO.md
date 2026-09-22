# inventory-tracker — build plan

## Done
- [x] **Slice 1 — Foundation.** Scaffold, common-core + `params` + category-schema
  model, `extends` resolution, write-time validation, file store + SQLite index,
  `inv` CLI skeleton. Verified against real invoice line items in `examples/`.
  Seeded schemas: `resistor`, `capacitor`, `ic-linear-reg` (+ abstract
  `physical`/`passive`/`ic` bases), `tool`.

- [x] **Slice 2 — Invoice parser.** `inv ingest <pdf>` (+ `--dry-run`): pdfplumber
  parse of DigiKey `SALESORDER_EMAIL*.pdf` → order record (`store/orders/`) + item
  stubs in the `unclassified` category. Idempotent upsert (created/updated/unchanged);
  cross-order purchases accumulate qty. Verified against all 5 sample invoices
  (42 unique parts, contiguous line numbers, amounts sum to the sales subtotal).

- [x] **Slice 3 — DigiKey API enrichment.** `inv enrich` (production OAuth2
  client-credentials, disk-cached responses). Per part: descend the `Category`
  breadcrumb to the leaf, reclassify out of `unclassified`, fill `params`, set
  canonical manufacturer, record `DatasheetUrl` as a `docs[]` entry. Curated
  categories (`resistor`/`ic-linear-reg`/`ic-opamp`, mapped in `schema/digikey_map.yaml`
  by stable ParameterId) get clean numeric keys with value normalization; all
  other leaf categories auto-provision a `provisional` schema seeded from DigiKey's
  ParameterText (raw values, lossless). `inv schema pending` lists them. Verified
  on all 42 parts (3 curated + 15 provisional categories, 0 invalid).

- [x] **Slice 4 — Datasheet cache.** `inv fetch`: downloads recorded `DatasheetUrl`s
  into a content-addressed cache `store/docs/<sha16>.pdf` (identical datasheets
  stored once), records path+sha256+bytes on the docs[] entry, and flags misses
  with `fetch_status` (failed / not-pdf) for the slice-5 fallback. First run:
  31/41 cached (24 unique PDFs, 7 deduped); 10 misses (6 HTML landing pages,
  4 fetch errors — some transient). Handles protocol-relative/http URLs.
- [x] **Slice 6 — Query layer.** `inv search --category C 'key<op>val' …`
  (numeric ranges + `~` substring for raw provisional values) and `inv alt <id>`
  (ranks owned same-category parts by `identifying`-param match). Verified.

- [x] **Slice 5 — Fallback datasheet recovery.** Two layers:
  (a) **HTTP** — `inv fetch` now uses a browser UA and resolves non-PDF responses
  (TI `?gotoUrl=` interstitial → real PDF; generic landing-page `.pdf` link).
  Recovered all 5 TI parts automatically. (b) **Browser** (Playwright MCP) for
  genuine bot-walls that reject non-browser TLS: recovered TDK (403), ST + Taiwan
  Semi (network-block via UA/TLS fingerprint), and the Panasonic landing page —
  by navigating and doing an in-page `fetch()` → base64 → store. **Result: 40/42
  cached.** Remaining: Analog Devices blocks this IP entirely (recorded
  `fetch_status: blocked`, get from own network); 1 part has no DigiKey datasheet URL.

## Next
- [ ] **`inventory-ingest` skill** wrapping ingest→enrich→fetch, plus the
  manuals-attachment path for tools (`inv doc add`).
- [ ] **Productize the browser fallback.** The bot-wall recovery was done via the
  Playwright MCP interactively this session; fold it into the tool with
  playwright-python so `inv fetch` can drive a headless browser itself. Needs a
  per-vendor referer/product-page step for hotlink-protected hosts (e.g. ADI).

## Bigger features (to design)
- [ ] **Email ingestion.** Poll an email client on an interval and auto-ingest
  purchase confirmations (DigiKey + other vendors) through the same upsert path as
  `inv ingest`, so the inventory updates automatically as well as manually. Needs:
  mailbox access (IMAP/Gmail API), per-vendor email parsers, dedup by order id,
  and a scheduler. Design session pending.

## Backlog / decisions
- [ ] Promote to a submodule (own GitHub repo) when ready to push.
- [ ] Package normalization (enum vs free string) once real data shows the spread.
- [ ] Add categories as ingestion surfaces them: `ic-opamp`, `diode`, `inductor`,
  `connector`, `heatsink`, … (invoice 96158221 alone touches most of these).
- [ ] Decide datasheet/manual storage: in-repo vs git-lfs, once the cache grows.
- [ ] SQLite-as-truth only if the inventory reaches tens of thousands of items.
