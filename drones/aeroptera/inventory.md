---
tier: reference
domain: drones
---

# Aeroptera Lace II "Aero" — parts

Parts for the [Lace II "Aero" printed-airframe build](README.md). **Nothing ordered — still being
evaluated.** Reorder links in [`../inventory/bom.md`](../inventory/bom.md).

The frame itself is **free** (STL / STEP / 3DM). Everything below is what it costs to actually fly.

## Filament — the gating purchase

⚠ **AE11–AE14 (superclamps and motor mountings) must be PETG-rCF08.** Not nylon — the manual warns
that materials as stiff as or stiffer than PA fracture — and not PLA, which creeps. Full per-part
table in the [README](README.md#per-component-material-and-wall-loops).

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| **Polymaker Fiberon PETG-rCF08** | ? | **to buy** | the structural material; **mandatory** for AE11–AE14, and first choice for most frame parts |
| **Polymaker Fiberon PETG-ESD** | ? | **to buy** | AE05/AE06/AE07 options, and **XE6C** — reduces static buildup where it contacts the FC and PDB |
| **Polymaker Fiberon PA612-CF15** | ? | **to buy** | AE04B, AE09 |
| **Polymaker Panchroma PLA** | ? | **to buy** | non-structural parts, landing gear (AE15–AE17) |
| 0.4 mm **hardened steel** nozzle | 1 | **check stock** | required — the CF-filled materials are abrasive |
| Filament drying | — | **check** | CF/nylon blends are hygroscopic |

## Frame hardware

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| **Carbon fiber tubes, 16 × 13 × 220 mm** | 4 | **to buy** | custom; longer tubes only if going past 15" props (untested by Aeroptera) |
| **M3 screw + nut kit, 6–30 mm** | 1 | **to buy** | **≥40× M3×25 mm**. ⚠ **not self-tapping**; nylock nuts not recommended (except the folding axis) |
| **Screw glue** | 1 | **to buy** | **required** — stops screws near the motors backing out under vibration |
| Nano tape (double-sided) | 1 | **to buy** | securing + dampening |
| XT60 splitter + extension cable | 1 | **to buy** | ~20 cm, PM07 out to the exterior |
| Zip ties, duct tape | — | **to buy** | cable fixing / insulation |
| 4S balance connector cable | 1 | optional | balancing is awkward once AE07 is assembled |

## Flight systems

⚠ **Pixhawk 6C + Holybro PM07 is the *only* recommended combination** — the bay is built around it.
Same stack as the [DH600](../dh600/README.md), so the config knowledge transfers.

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| Holybro **Pixhawk 6C** | 1 | **to buy** | + the printed `XE6C` bridge to stack it on the PM07 |
| Holybro **PM07** power manager | 1 | **to buy** | power module + distribution, 2-in-1 |
| Holybro **M10** GPS | 1 | **to buy** | |

## Power & propulsion

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| **Hobbywing X-Rotor 40 A ESC** | 4 | **to buy** | identical to the DH600's ESC |
| **SunnySky V3506 KV650** motor | 4 | **to buy** | reference build; frame works with most motors for a 1–5 kg aircraft |
| **SunnySky EOLO 13.5×5 foldable** prop | 4 | **to buy** | up to 15" fits; ≤13.5" recommended for polymer props |
| **4S 4500 mAh 100C pack** | **2** | **to buy** | ⚠ **dual-battery — a matched pair is required for every flight**. XT60. Each pack must fit under **45 × 148 × 31 mm** |

_Note: the X500's OVONIC **4S 4500 mAh XT60 ×2** match the recommended spec on form factor (50C vs
100C recommended) — worth checking dimensions against the 45×148×31 mm limit before buying new._

## Video / control link — open

The manual's own Skydroid recommendation is **disclaimed** ("the unit we received was flawed… users
are asked to select their own").

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| Control + video link | 1 | **to decide** | SIYI HM30 already owned for the DH600 is a candidate |
| Gimbal / camera payload | ? | **to decide** | >1.5 kg payload capacity; `XEGP` gimbal protector exists but is untested |

## Printed parts

28 STL files — full manifest in the [README](README.md#download-manifest). Global settings: **0.2 mm
layer, 20–25 % infill, grid/gyroid, tree supports, 0.4 mm hardened nozzle**. AE01/AE02/AE03 print
**diagonally** and have sliced `.3mf` files provided (⚠ **sliced for the Bambu Lab A1**).
