---
tier: reference
domain: drones
---

# BM Aether 4 — parts

Parts for the [BM Aether 4 build](README.md). Reorder links in
[`../inventory/bom.md`](../inventory/bom.md).

⚠ **The setup is not chosen yet.** The designer publishes three quite different configurations
(sub-250 g, 6S freestyle, 4S Li-Ion long range) and they imply different motors, props, batteries
**and wall count**. Everything below marked "to buy" is gated on that choice — see the
[setup table](README.md#designers-setup-examples).

## Airframe

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| Aether 4 frame (printed, unibody) | 1 | **printing** | free model, MakerWorld; profile **Frame V1.1**. ~40 g @ 2 walls / 0 % infill |
| **BetaFPV Pavo 20 VTX chassis** | 1 | **on hand** ✅ | not in the print files — the one bought part of the airframe. A couple already owned |
| Filament | — | — | PLA adequate; CF-reinforced better. ⚠ high-temp filament if it becomes a freestyle/racing build |

## Power & propulsion

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| **HDZero Gamma 45A HD-Ready AIO** | 1 | **ordered 2026-09-01** | $79.99; 1 of a pair (other → [Carnage 4.5](../carnage-45/inventory.md)). G473 + ICM42688, **45 A cont / 60 A burst AM32**, **3–6S**, 33×33 mm / **25.5×25.5 M2**, **8.4 g**. ⚠ bought as "40 A" — confirm the model on arrival |
| Motor | 4 | **to buy** | **9×9 or 12×12** pattern. Depends on setup: 1504 KV2300 / 1404 KV2800 (sub-250) · 2006 KV1900 or 2204 KV1800 (6S freestyle) · 1404 KV2800 (long range) |
| Prop | 4 | **to buy** | **4.5" max.** GemFan 4525-3 across all three setups; 4024-2 for the 4" sub-250 variant |
| Battery | ? | **to buy** | 4S 850 mAh LiPo (~93 g, sub-250) · 6S 850–1300 mAh (freestyle) · **4S 3000 mAh 18650 Li-ion** (long range, >30 min) |

## Control & navigation

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| ~~ELRS receiver~~ | — | **not needed** ✅ | **built into the Gamma AIO** (2.4 GHz, on a UART). Bind to `dwdrones` |
| GPS holder (printed) | 1 | optional | a **GPS Holder** profile (49 min) is published alongside the frame |
| TPU antenna mount (printed) | 1 | optional | published alongside the frame (15 min) |

## Video / FPV — ⚠ undecided, and it's the blocking decision

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| VTX | 1 | **to buy** | ⚠ **the frame's bay is the Pavo 20 chassis**, shaped for **DJI O3 / Caddx Vista / RunCam Link**. The Gamma is HDZero-branded and HD-**ready** (generic 8 V/3 A VTX rail, no integrated VTX), so it will feed either — the *mount* is what forces the choice |
| _Alternative mount_ | 1 | **candidate** | [Aether Moonlight VTX mount](https://makerworld.com/en/models/1609574-aether-moonlight-mount) — the lead for fitting an HDZero VTX instead of an O3 |
| Camera | 1 | **to buy** | follows the VTX choice |

## Weight

The designer's sub-250 g setup lands at **~250 g TOW on a 40 g frame** — i.e. already at the ceiling,
which is why [infill is ruled out](README.md#-infill-vs-the-weight-budget--measured-2026-08-17) for
that configuration. Record measured masses as parts arrive.

| Item | Mass |
|---|---|
| Frame @ 2 walls / 0 % infill | ~40 g (designer) · **50 g @ 5 %** · **55 g @ 10 %** (own slicer figures) |
| HDZero Gamma 45A AIO | **8.4 g** (vendor) |
| 4× motor | ? |
| 4× prop | ? |
| VTX + camera + Pavo 20 chassis | ? |
| Battery | ~93 g (4S 850 mAh, designer's sub-250 pack) |
| **Measured TOW** | ? |
