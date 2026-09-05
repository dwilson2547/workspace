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

| Craft | Class | Status | Video / control | Page | Inventory |
|-------|-------|--------|-----------------|------|-----------|
| **BetaFPV Pavo20 Pro II** | 2.2" FPV cinewhoop (<250g) | flying | DJI O4 digital FPV, ELRS | [`pavo20-pro-2/`](pavo20-pro-2/README.md) | [parts](pavo20-pro-2/inventory.md) |
| **BetaFPV Pavo Femto** | 75mm micro cinewhoop (BNF) | flying | DJI O4 HD, ELRS | [`pavo-femto/`](pavo-femto/README.md) | [parts](pavo-femto/inventory.md) |
| **Holybro X500 V2** | 500mm PX4/ArduPilot development quad | bench config done, not flown | GPS autonomy (Pixhawk 6C / M10); **VLP-16 lidar payload** | [`x500/`](x500/README.md) | [parts](x500/inventory.md) |
| **CineLog 3.5 ToF** | 3.5" ducted indoor autonomy | **wired except the ESP32** | ToF ring + optical flow + **ESP32-S3** companion; **HDZero**, ELRS | [`cinelog35-tof/`](cinelog35-tof/README.md) | [parts](cinelog35-tof/inventory.md) |
| **DH600** | 600mm folding long-endurance cinematic platform | **all parts on hand; blocked on a custom top plate** | SIYI HM30 HD link + A8 mini gimbal (Pixhawk 6C / PM07) | [`dh600/`](dh600/README.md) | [parts](dh600/inventory.md) |
| **"Angel30"** | 3" 4S freestyle (Angel30 frame, 149 mm) | **flying** | **HDZero** Freestyle V2 + Nano90 cam (cam being replaced); ELRS | [`freestyle-3in/`](freestyle-3in/README.md) | [parts](freestyle-3in/inventory.md) |
| **V2 Carnage 4.5"** | 4.5" light class (Sub250gFPV design) | frame + FC ordered | **HDZero** — Gamma AIO (ELRS built in) + spare 14 mm cam; VTX to buy | [`carnage-45/`](carnage-45/README.md) | [parts](carnage-45/inventory.md) |
| **Reliant V2 (F121)** | 4" **Y6**, long range (6 motors, 3 arms) | **built** — ⛔ awaiting a replacement VTX | **HDZero** Whoop V2 + Nano V3; ELRS | [`f121-reliant-v2/`](f121-reliant-v2/README.md) | [parts](f121-reliant-v2/inventory.md) |
| **Aeroptera Lace II "Aero"** | **800 mm 3D-printed folding quad**, >5 kg takeoff, >1.5 kg payload | _considering_ | open (Pixhawk 6C + PM07 mandatory) | [`aeroptera/`](aeroptera/README.md) | [parts](aeroptera/inventory.md) |
| **BM Aether 4** | 4/4.5" **3D-printed unibody** frame, ~40 g | **now a build** — FC ordered | ⚠ undecided — frame's bay is O3-shaped, fleet is HDZero | [`aether-4/`](aether-4/README.md) | [parts](aether-4/inventory.md) |
| **Jet Catamaran** _(planned build)_ | 3D-printed twin-hull **surface** boat, dual 30mm water-jets | planned | ELRS (throttle + steering + reverse) | [`jet-catamaran/`](jet-catamaran/README.md) | [parts](jet-catamaran/inventory.md) |

_Planned purchase: **Pavo35 or similar** (see [bom](inventory/bom.md))._

### Shelved

- **SAR drone** — a search-and-rescue build that would drop a flotation device over water and mark
  the position for a rescue crew. Shelved 2026-08-17. The mission requires a thermal sensor (a
  visual-spectrum camera does not find a person in open water in rescue conditions), and thermal
  gimbals at a useful capability — the **SIYI ZT6** was the candidate — are tightly export/import
  controlled. Price was not the blocker. Full reasoning:
  [`docs/notes/`](docs/notes/README.md).

### Video ecosystems

The fleet spans **three**, but the question posed here in August has answered itself: **the small
craft consolidated on HDZero.**

| Ecosystem | Craft | Ground side |
|---|---|---|
| **HDZero** | CineLog 3.5 ToF · **3" freestyle** · **Reliant Y6** · Carnage 4.5 _(planned)_ | ProBox+ |
| **DJI O4** | Pavo20 Pro II, Pavo Femto | DJI Goggles N3 |
| **SIYI HM30** | DH600 | HM30 ground unit (+ LAN→HDMI to goggles) |

Only the **[Aether 4](aether-4/README.md)** is still open, and it's the awkward one: its VTX bay is
the **BetaFPV Pavo 20 chassis**, shaped for DJI O3 / Caddx Vista / RunCam Link, so joining the
HDZero majority needs a different printed mount.

#### ⚠ HDZero VTX power is not uniform — read the FC pad, every time

**This cost a VTX on 2026-09-01.** HDZero's VTXs have very different input ranges, and an AIO's
"digital VTX" pad is **not a standard rail** — it varies from a regulated 5 V to raw pack voltage by
board. The two have to be checked against each other per build:

| VTX | Input range | On the fleet |
|---|---|---|
| **HDZero Whoop V2** | **3 – 12.6 V (1S–3S)** — narrow, no reverse-polarity protection | CL35 (on a **regulated 12 V** pad — in spec by 0.6 V) · **Reliant Y6 (destroyed on a raw-pack pad at 4S)** |
| **HDZero Freestyle V2** | **7 – 25 V (2S–6S)** — forgiving | 3" freestyle |

| FC | Video pad supplies |
|---|---|
| MicoAir 743-AIO | **regulated 12 V** |
| **HGLRC Specter 6-in-1** | **`7.4–26.4 V` — raw pack voltage** ⚠ |
| **SpeedyBee F405 AIO V2** | **9 V @ 1.5 A** (also 5 V @ 1.5 A, 4V5 @ 1 A) — ⚠ *current*-limited, see below |
| **HDZero Gamma 45A AIO** | **protected 8 V / 3 A** ✅ — structurally safe for any HDZero VTX |
| _(external)_ **Matek Micro BEC** | **5 V default / 9 V / 12 V** by jumper, ~2.6–2.8 A at 4S, OCP + thermal ✅ — the retrofit answer when the FC's pad is wrong |

⚠ **Voltage isn't the only budget — check current too.** The Freestyle V2 draws **6–15 W**; on the
SpeedyBee's 9 V rail that peaks at **1.67 A against a 1.5 A BEC**. Fine at 25/200 mW, a ceiling if
the VTX is ever unlocked to 1 W.

Full writeup: [Reliant Y6 — VTX failure](f121-reliant-v2/README.md#-vtx-failure--the-video-power-pad-is-pack-voltage).

Mounting patterns aren't uniform either: the **Freestyle V2 is 20×20**, while the Whoop V2 and the
frames' native HDZero patterns are **25.5×25.5** — so those VTXs don't swap between craft.

### Shared hardware worth knowing about

Cross-craft overlaps that already exist and are easy to forget:

| Item | Craft |
|---|---|
| **Pixhawk 6C + Holybro PM07 + M10** | DH600 · **Aeroptera** (only recommended stack) · X500 (6C) |
| **Hobbywing X-Rotor 40 A ESC** | DH600 · **Aeroptera** (reference build) |
| **4S 4500 mAh XT60 packs** | X500 (2 on hand) · **Aeroptera** wants a matched pair of the same spec |
| **HDZero ecosystem** | CL35 · 3" freestyle · Reliant Y6 · ProBox+ ground side · spare 14 mm cam suits the Carnage |
| **HDZero Gamma 45A AIO** (×2 ordered) | Carnage 4.5 · Aether 4 — built-in ELRS, 8 V VTX rail |
| **HDZero Nano V3 camera** | Reliant Y6 · the leading replacement for the 3" freestyle's Nano90 |
| **iFlight XING 1404** motor platform | Reliant Y6 (**3800 KV** ×6) · Angel30 3" (**4600 KV** ×4) — both Amazon-sourced for availability |
| **1.5 mm T-mount props** | Reliant Y6 (Nazgul T4030) · Angel30 3" (HQProp T3X2X3) — buy to the shaft, not the name |
| **RadioMaster RP3 ELRS**, bind `dwdrones` | X500 · CL35 · DH600 · 3" freestyle · Reliant Y6 |
| **RushFPV Cherry** 5.8 GHz RHCP antenna | 3" freestyle · Reliant Y6 — ⚠ order **U.FL**; the MMCX one belongs to the spare Rush Tank |
| **VLP-16 Lite + interface box** | X500 payload · shared with `tools/point-cloud-visualizer` |

## Inventory

Parts are tracked **per craft** so the on-hand list reflects what actually belongs to each drone,
not one big shared pool.

- [`x500/inventory.md`](x500/inventory.md) — batteries, RX, spares, **VLP-16 lidar payload**
- [`pavo20-pro-2/inventory.md`](pavo20-pro-2/inventory.md) — batteries, FPV, spares for the Pavo
- [`cinelog35-tof/inventory.md`](cinelog35-tof/inventory.md) — ToF ring, muxes, ESP32, HDZero gear
- [`dh600/inventory.md`](dh600/inventory.md) — frame, motors/ESCs, Pixhawk 6C + PM07, full SIYI stack
- [`f121-reliant-v2/inventory.md`](f121-reliant-v2/inventory.md) ·
  [`freestyle-3in/inventory.md`](freestyle-3in/inventory.md) — **the two 2026 builds that fly**
  (the 3" airframe half is still unrecorded)
- [`carnage-45/inventory.md`](carnage-45/inventory.md) · [`aether-4/inventory.md`](aether-4/inventory.md)
  · [`aeroptera/inventory.md`](aeroptera/inventory.md) — the builds in progress, mostly unspecced
- [`jet-catamaran/inventory.md`](jet-catamaran/inventory.md) — jet drives, motors, ESCs, hull/fab parts
- [`inventory/shared-gear.md`](inventory/shared-gear.md) — radio, charger, bench consumables, and
  unassigned spares (gear shared across craft)
- [`inventory/bom.md`](inventory/bom.md) — master bill of materials with reorder links

## Knowledge

- [`docs/topics/elrs/`](docs/topics/elrs/README.md) — **ELRS radio link** doc set: radio config
  (TX16S), a receiver doc + a pairing/test-log doc per drone, shared test ladder, and the
  **binding phrase**
- [`docs/topics/mission-planner-linux.md`](docs/topics/mission-planner-linux.md) — **Mission Planner
  ground station** install/setup on Ubuntu (Mono, XWayland launcher, serial access, SITL)
- Domain-wide notes: [`docs/notes/`](docs/notes/README.md) (atomic facts via `meta/bin/wsnote`)
- Long-form guides: [`docs/topics/`](docs/topics/)
