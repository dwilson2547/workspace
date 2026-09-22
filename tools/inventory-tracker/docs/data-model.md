# Data model

The storage layer is built to hold wildly different things — a 0.1% resistor, a
TO-220 regulator, a battery charger with a scanned manual — without the `params`
metadata degrading into a swamp of inconsistent tags. It does that with **one
record envelope, a typed inner block, and a schema registry that validates on
write**.

## One envelope for everything

Every item — component, tool, consumable — is a single YAML file with the same
[common-core fields](../schema/core.yaml): `id`, `type`, `category`,
`description`, `manufacturer`, `mpn`, `vendor_pns`, `qty`, `location`, `docs[]`,
`projects[]`, `purchases[]`, `tags`, `notes`, and `params`. Tools and manuals
live entirely in the core fields with an empty `params: {}`; components fill
`params` in. The CLI and views never branch on item type.

- `type` — coarse bucket for filtering (`component`, `tool`, `consumable`, `accessory`, `equipment`).
- `category` — selects which **params schema** applies (`resistor`, `capacitor`, `ic-linear-reg`, `tool`, …).

## The typed `params` block

`params` is the "metadata column" — but its allowed keys are **declared per
category, not invented per part**. Each category schema lives in
[`schema/categories/`](../schema/categories/) and may `extends` an abstract base;
params merge down the chain, child winning on conflicts:

```
physical (package, mounting)
 └─ passive (temp_coeff)          └─ ic (supply_voltage_*, temp_*)
     ├─ resistor                      └─ ic-linear-reg
     └─ capacitor
```

Each param declares `type` (`number`/`integer`/`boolean`/`enum`/`string`),
optional `unit`, `values` (for enums), and `required`. Numeric params are stored
**canonical** (resistance in ohms: `10k` → `10000`) so cross-part comparison and
`inv search` are real numeric filters, not string matching.

`identifying` lists the params that define part identity — used for dedup on
ingest and as the match key for `inv alt` (alternatives you already own).

## Standardization is enforced on write

- **Off-schema keys are rejected.** `inv add` / `inv validate` fail on an unknown
  param, an abstract category, or a bad enum value — you can't create `ohms` on
  one part and `resistance` on another.
- **Unknown params are quarantined, not silently kept.** Enrichment that returns
  a param not yet in the schema surfaces as a warning (a pending-review queue),
  so you promote new keys deliberately. Canonical names get **seeded from the
  DigiKey API's parameter taxonomy** so they match one authoritative source.

## Documents (datasheets and manuals)

A datasheet and a scanned tool manual share one model: entries in an item's
`docs[]` list, each `{ path, kind, sha256?, source? }` where `kind` is one of
`datasheet`, `manual`, `guide`, `drawing`, `cert`, `other`. A manual is **not**
its own item — it attaches to the tool it documents. PDFs live under
`store/docs/` and `store/manuals/`; agents read them directly.

## Physical storage + index

- **Source of truth:** one YAML file per item under `store/items/<category>/<id>.yaml`.
  Git-tracked, diffable, agent-readable.
- **Index:** `inventory.db` (SQLite, gitignored) rebuilt from the files by
  `inv reindex`. All writes go through the CLI, which owns both; the DB is never
  authoritative and never hand-edited.
- **Views:** `inv export md` generates `views/parts.md`, a flat browsable table.
