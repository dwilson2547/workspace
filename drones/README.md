---
tier: reference
domain: drones
---

# drones

Radio-controlled craft I own — mostly UAV / multirotor, plus a surface build — with their build
configs and a running parts inventory. They share one ecosystem (ELRS radio, 4S LiPo packs, HOTA
charger, water-cooled brushless gear). This domain is a knowledge/reference section (no runnable
code) — everything here is Markdown for tracking hardware, specs, spares, and flight/build notes.

## Craft

| Craft | Class | Video / control | Page | Inventory |
|-------|-------|-----------------|------|-----------|
| **Holybro X500 V2** | 500mm PX4 development quad | GPS autonomy (Pixhawk 6C / M10 / PX4) | [`x500/`](x500/README.md) | [parts](x500/inventory.md) |
| **BetaFPV Pavo20 Pro II** | 2.2" FPV cinewhoop (<250g) | DJI O4 digital FPV, ELRS | [`pavo20-pro-2/`](pavo20-pro-2/README.md) | [parts](pavo20-pro-2/inventory.md) |
| **BetaFPV Pavo Femto** | 75mm micro cinewhoop (BNF) | DJI O4 HD, ELRS | [`pavo-femto/`](pavo-femto/README.md) | [parts](pavo-femto/inventory.md) |
| **CineLog 3.5 ToF** _(planned build)_ | 3.5" ducted indoor autonomy | ToF + optical flow + Pi companion, ELRS | [`cinelog35-tof/`](cinelog35-tof/README.md) | [parts](cinelog35-tof/inventory.md) |
| **Jet Catamaran** _(planned build)_ | 3D-printed twin-hull **surface** boat, dual 30mm water-jets | ELRS (throttle + steering + reverse) | [`jet-catamaran/`](jet-catamaran/README.md) | [parts](jet-catamaran/inventory.md) |

_Planned purchase: **Pavo35 or similar** (see [bom](inventory/bom.md))._

## Inventory

Parts are tracked **per craft** so the on-hand list reflects what actually belongs to each drone,
not one big shared pool.

- [`x500/inventory.md`](x500/inventory.md) — batteries, RX, spares for the X500
- [`pavo20-pro-2/inventory.md`](pavo20-pro-2/inventory.md) — batteries, FPV, spares for the Pavo
- [`jet-catamaran/inventory.md`](jet-catamaran/inventory.md) — jet drives, motors, ESCs, hull/fab parts
- [`inventory/shared-gear.md`](inventory/shared-gear.md) — radio, charger, bench consumables, and
  unassigned spares (gear shared across craft)
- [`inventory/bom.md`](inventory/bom.md) — master bill of materials with reorder links

## Knowledge

- [`docs/topics/elrs/`](docs/topics/elrs/README.md) — **ELRS radio link** doc set: radio config
  (TX16S), a receiver doc + a pairing/test-log doc per drone, shared test ladder, and the
  **binding phrase**
- Domain-wide notes: [`docs/notes/`](docs/notes/README.md) (atomic facts via `meta/bin/wsnote`)
- Long-form guides: [`docs/topics/`](docs/topics/)
