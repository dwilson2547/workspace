---
tier: reference
domain: drones
---

# V2 Carnage 4.5" — parts

Parts for the [V2 Carnage 4.5" build](README.md). Reorder links in
[`../inventory/bom.md`](../inventory/bom.md).

## Airframe & power

| Item | Qty | Status | Price | Notes |
|------|-----|--------|-------|-------|
| V2 Carnage 4.5" CF frame (cncdrones C169) | 1 | **ordered 2026-08-17** | from $39.00 | cut to order, ~6–10 business days. ⚠ **record which thickness / colour / standoff length was ordered** |
| **HDZero Gamma 45A HD-Ready AIO** | 1 | **ordered 2026-09-01** | $79.99 | 1 of a pair (other → [Aether 4](../aether-4/README.md)). G473 + ICM42688, **45 A cont / 60 A burst AM32**, **3–6S**, 33×33 mm / **25.5×25.5 M2**, **8.4 g**. Built-in **2.4 GHz ELRS**; **8 V/3 A VTX BEC** + 5 V/3 A. ⚠ bought as "40 A" — confirm the model on arrival |
| Motor, **1804 or 2004** | 4 | **to buy** | ? | **12×12 mm** mount pattern |
| Prop, **4.5"** | — | **to buy** | ? | designer recommends **Gemfan 4523-3** |
| Battery | 0 | **to buy** | ? | 4S-class; sizing depends on the sub-250 g decision |

## Control & navigation

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| ~~ELRS receiver~~ | — | **not needed** ✅ | **built into the Gamma AIO** (2.4 GHz, on a UART). Still bind to `dwdrones` |

## Video / FPV — HDZero indicated

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| HDZero VTX | 1 | **to buy** | top plate has a **native HDZero 25.5×25.5** pattern. ⚠ the Gamma is **"HD-ready", not VTX-integrated** — this is still a purchase |
| _(VTX power)_ Gamma 8 V / 3 A BEC | — | **covered by the AIO** ✅ | protected regulated rail — avoids the raw-pack-voltage pad that [killed the Y6's VTX](../f121-reliant-v2/README.md#-vtx-failure--the-video-power-pad-is-pack-voltage) |
| **HDZero 14 mm camera** | 1 | **already on hand** ✅ | the one that shipped with the [CL35's Whoop V2 bundle](../cinelog35-tof/inventory.md) and didn't fit that frame — **this frame takes 14 mm for HD** |
| _(ground side)_ HDZero ProBox+ | — | on hand | shared |

Alternative top-plate patterns if HDZero is dropped: WalkSnail 25.5×25.5, Caddx Vista 20×20, TBS
Crossfire Sixty9 20×20, HappyModel Fyujon, generic VTX 16×16. Analogue cameras are **19 mm** on this
frame.

## Printed parts

⚠ **Not supplied by the vendor** — CF and hardware only. Source from the designer:
<https://www.thingiverse.com/sub250gfpv/designs>

| Part | Qty | Status |
|------|-----|--------|
| _(identify from the designer's Thingiverse)_ | — | **to determine + print** |
