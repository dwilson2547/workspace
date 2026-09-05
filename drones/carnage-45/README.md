---
tier: reference
domain: drones
---

# V2 Carnage 4.5"

**Planned build. Frame ordered 2026-08-17.** A 4.5" airframe designed by **Phil (Sub250gFPV)**,
manufactured and shipped by [Cncmadness / cncdrones.com](https://cncdrones.com/v2-carnage-45.html)
(part **C169**, from **$39**). Bought in the same order as the
[Reliant V2 Y6](../f121-reliant-v2/README.md).

Status: **frame ordered. Nothing else specified.**

⚠ **Correction to the initial assumption: this is a sub-250 g design, not an open freestyle build.**
The designer's handle is literally *Sub250gFPV*, and the recommended motors are **1804 / 2004 on a
12×12 mm pattern** — light-class hardware. That settles what looked like an open 4S-vs-6S question:
**this is not a 6S build.** It also means the fleet now has **two sub-250 g airframes in progress**,
this and the Y6.

## Frame spec

Taken verbatim from the vendor listing.

| Parameter | Value |
|---|---|
| Design | **V2 Carnage 4.5"** by Phil (**Sub250gFPV**) |
| Vendor | Cncmadness, part **C169** — **from $39.00** |
| ⚠ Licensing | **Not open source.** Files are not provided and cannot be modified |
| Availability | **Cut to order**, ~**6–10 business days** |
| Props | **4.5"** — designer recommends **Gemfan 4523-3** |
| Bottom plate | **3 mm or 4 mm**, one piece (4 mm is +$4) |
| Top plate | **2 mm** |
| Standoffs | **15 / 20 / 25 mm** options |
| Motor pattern | **12 × 12 mm** — recommended **1804, 2004** |
| Base plate FC/ESC/AIO holes | 20×20, 25.5×25.5, and **Whoop 25.5×25.5 AIO** |
| Camera | **14 mm for HD cameras**, **19 mm for analogue** |
| Type | "Analogue **and** Digital HD Frame" |

### Order options (choose at purchase)

| Option | Choices |
|---|---|
| Carbon thickness | 3 mm · **4 mm (+$4)** |
| Carbon colour / grade | **Black T700** · Black T300 (−$4) · Blue · Green · Gold · Silver · Pink |
| Standoff length | 15 mm · 20 mm · 25 mm |

⚠ **Record which options were selected on the order** — thickness and standoff length change the
build, and neither is recoverable from the frame later without measuring.

## Flight controller — HDZero Gamma 45A AIO (ordered)

**A pair of HDZero AIOs was ordered 2026-09-01** — one for this build, one for the
[Aether 4](../aether-4/README.md). No other parts have been bought for either.

⚠ **Recorded as the HDZero Gamma 45A HD-Ready AIO** — described at purchase as a "40 A" HDZero AIO,
and the Gamma is the only 40-A-class AIO HDZero sells (their other two are the 1S AIO5 at 5 A and
the 2–3S AIO15 at 15 A). **Confirm against the order confirmation**; the specs below are the Gamma's.

| Parameter | Value |
|---|---|
| Price | **$79.99** |
| MCU / gyro | **STM32G473** (170 MHz) / ICM42688 |
| ESC | **45 A continuous, 60 A burst** per motor, **AM32** firmware |
| Cells | **3–6S** |
| **RC link** | ✅ **built-in 2.4 GHz ExpressLRS receiver** (UART) |
| **Video power** | ✅ **protected 8 V / 3 A BEC**, intended for digital VTXs |
| Peripheral power | 5 V / 3 A |
| Size / mounting | 33 × 33 mm, **25.5 × 25.5 mm M2** |
| Weight | **8.4 g** |
| Video | **"HD-ready"** — takes a digital VTX, does **not** integrate one |

Three consequences worth having written down:

- **It drops the separate ELRS receiver** from the parts list. Bind phrase `dwdrones` as usual.
- **It fits this frame's base plate as-is** — 25.5×25.5 is one of the three patterns the Carnage
  offers, and 8.4 g is close to free on a light build.
- ✅ **Its 8 V VTX rail structurally prevents the failure that killed the
  [Y6's VTX](../f121-reliant-v2/README.md#-vtx-failure--the-video-power-pad-is-pack-voltage).** Where
  the HGLRC Specter hands a digital VTX raw pack voltage off a `7.4–26.4 V` pad, the Gamma regulates
  to a protected 8 V — comfortably inside every HDZero VTX's range, at 4S or 6S. This is a real
  reason to prefer it, not a footnote.

⚠ **"HD-ready" still means a VTX has to be bought.** The AIO supplies power and a connector; it is
not an integrated-VTX board like the AIO5/AIO15.

## The video decision is basically made

The top plate has **native HDZero mounting (25.5 × 25.5)**, alongside WalkSnail (25.5×25.5), Caddx
Vista (20×20), TBS Crossfire Sixty9 (20×20), HappyModel Fyujon, and generic VTX (16×16).

More usefully — **this frame takes a 14 mm camera for HD**, and the
[HDZero Whoop V2 bundle bought for the CL35](../cinelog35-tof/README.md#video--hdzero) **came with a
14 mm camera that didn't fit the CL35** (which needed 19 mm, hence the separate Micro V3 purchase).
That spare 14 mm camera has a home here. Combined with the **ProBox+** already owned on the ground
side, HDZero is the obvious and nearly-free choice for this build.

## Spec

| Item | Part | Status |
|------|------|--------|
| Frame | **V2 Carnage 4.5" (C169)**, cncdrones.com | **ordered 2026-08-17** |
| Flight controller / ESC | **HDZero Gamma 45A HD-Ready AIO** (25.5×25.5) | **ordered 2026-09-01** (1 of a pair) |
| Motors | ×4, **1804 or 2004**, **12×12 mm** pattern | not selected |
| Props | **4.5"** — Gemfan 4523-3 recommended | not selected |
| RC link | **ELRS built into the Gamma AIO**, bind phrase `dwdrones` | **covered — no separate RX needed** |
| Video / FPV | **HDZero** — 25.5×25.5 top plate + the spare 14 mm camera; VTX still to buy | strongly indicated |
| Battery | 4S-class (sub-250 g design) | not selected |
| Autopilot stack | Betaflight assumed | not decided |

Parts: [`inventory.md`](inventory.md).

## Printed parts

⚠ **The vendor supplies CF and hardware but explicitly does *not* supply the 3D printed parts.** They
come from the designer:

- **<https://www.thingiverse.com/sub250gfpv/designs>**

Work out which printed parts this build needs (camera mount, antenna mounts, etc.) and print them
before assembly rather than discovering the gap mid-build.

## ⚠ Open decisions

- **Does this actually target sub-250 g?** The designer's whole identity is sub-250 g and the motor
  recommendation matches, but a 4.5" with a 4 mm bottom plate and a full HD VTX may not get there.
  Decide whether you're building to the designer's intent or just using a good 4.5" frame — it
  changes motor, battery and VTX choices.
- **Relationship to the [3" freestyle](../freestyle-3in/README.md)** — still worth resolving. Both
  are freestyle-class and neither is built.
- **Which order options were chosen** (see above).

## Status

- [x] Frame ordered (2026-08-17) — cut to order, ~6–10 business days
- [x] **FC/ESC ordered** — HDZero Gamma 45A AIO, 25.5×25.5 (2026-09-01)
- [ ] **Confirm the AIO that arrives is the Gamma 45A** (recorded from a "40 A" description)
- [ ] Record the carbon thickness / colour / standoff length actually ordered
- [ ] Decide whether this is a strict sub-250 g build
- [ ] Motors (1804 / 2004, 12×12) and props (Gemfan 4523-3) ordered
- [ ] **HDZero VTX ordered** — the Gamma is "HD-ready", not VTX-integrated
- [ ] Video confirmed — HDZero, using the **spare 14 mm camera** from the Whoop V2 bundle
- [ ] Bind the Gamma's **built-in ELRS** to `dwdrones` (no separate RX to fit)
- [ ] Printed parts identified and printed (from Sub250gFPV's Thingiverse)
- [ ] Assembled
- [ ] ELRS bound (`dwdrones`)
- [ ] Motor order + direction verified
- [ ] First flight

## Build log

- **2026-09-01** — **Flight controller ordered** — a **pair** of HDZero AIOs, one for this build and
  one for the [Aether 4](../aether-4/README.md), which turns the Aether from a print into a build.
  Recorded as the **HDZero Gamma 45A HD-Ready AIO** ($79.99, G473 + ICM42688, 45 A AM32, 3–6S,
  33×33 mm / 25.5×25.5, 8.4 g) — described at purchase as "40 A", and the Gamma is the only
  40-A-class AIO HDZero sells, so **confirm on arrival**. Two features settle open items here: a
  **built-in 2.4 GHz ELRS receiver** removes the separate RX from the parts list, and a **protected
  8 V / 3 A VTX BEC** structurally prevents the pack-voltage failure that
  [destroyed the Y6's VTX](../f121-reliant-v2/README.md#-vtx-failure--the-video-power-pad-is-pack-voltage)
  the same week. It is **"HD-ready", not VTX-integrated** — an HDZero VTX still has to be bought.
  Nothing else ordered for this build: motors, props and battery remain open.
- **2026-08-17** — **Frame ordered**: V2 Carnage 4.5" (C169) from cncdrones.com, in the same order as
  the [Reliant V2 Y6](../f121-reliant-v2/README.md). Vendor detail recovered and it reframes the
  build: the designer is **Phil (Sub250gFPV)** and the recommended motors are **1804/2004 on 12×12**,
  so this is a **light/sub-250-class 4.5"**, not an open freestyle platform — the 4S-vs-6S question
  I had recorded is moot. Two useful findings: the top plate has a **native HDZero 25.5×25.5**
  pattern, and the frame takes a **14 mm HD camera** — which is exactly the camera the HDZero Whoop
  V2 bundle shipped and the CL35 couldn't use. Also noted the frame is **not open source** (no files)
  and that **printed parts are not supplied** — they come from the designer's Thingiverse.

## Links

- **Vendor (frame, cut to order)** — V2 Carnage 4.5", cncdrones.com C169: <https://cncdrones.com/v2-carnage-45.html>
- **3D printed parts** — Sub250gFPV on Thingiverse: <https://www.thingiverse.com/sub250gfpv/designs>

### Designer (Phil / Sub250gFPV)

- Instagram: <https://www.instagram.com/sub250gfpv/>
- YouTube: <https://www.youtube.com/sub250gfpv>
- RotorBuilds: <https://www.rotorbuilds.com/profile/11377>
