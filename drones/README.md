---
tier: reference
domain: drones
---

# drones

UAV / multirotor craft I own, their build configs, and a running parts inventory. This domain is a
knowledge/reference section (no runnable code) — everything here is Markdown for tracking hardware,
specs, spares, and flight/build notes.

## Craft

| Craft | Class | Video / control | Page | Inventory |
|-------|-------|-----------------|------|-----------|
| **Holybro X500 V2** | 500mm PX4 development quad | GPS autonomy (Pixhawk 6C / M10 / PX4) | [`x500/`](x500/README.md) | [parts](x500/inventory.md) |
| **BetaFPV Pavo20 Pro II** | 2.2" FPV cinewhoop (<250g) | DJI O4 digital FPV, ELRS | [`pavo20-pro-2/`](pavo20-pro-2/README.md) | [parts](pavo20-pro-2/inventory.md) |

## Inventory

Parts are tracked **per craft** so the on-hand list reflects what actually belongs to each drone,
not one big shared pool.

- [`x500/inventory.md`](x500/inventory.md) — batteries, RX, spares for the X500
- [`pavo20-pro-2/inventory.md`](pavo20-pro-2/inventory.md) — batteries, FPV, spares for the Pavo
- [`inventory/shared-gear.md`](inventory/shared-gear.md) — radio, charger, bench consumables, and
  unassigned spares (gear shared across craft)
- [`inventory/bom.md`](inventory/bom.md) — master bill of materials with reorder links

## Knowledge

- [`docs/topics/elrs/`](docs/topics/elrs/README.md) — **ELRS radio link** doc set: radio config
  (TX16S), a receiver doc + a pairing/test-log doc per drone, shared test ladder, and the
  **binding phrase**
- Domain-wide notes: [`docs/notes/`](docs/notes/README.md) (atomic facts via `meta/bin/wsnote`)
- Long-form guides: [`docs/topics/`](docs/topics/)
