---
tier: reference
domain: drones
---

# BM Aether 4

**Now a build.** A fully 3D-printed **unibody** FPV frame for 4/4.5" drones by **Dr. J. Ma**,
published free on MakerWorld. It started as a print-because-it's-cheap exercise; **an
[HDZero Gamma 45A AIO was bought for it on 2026-09-01](#flight-controller--hdzero-gamma-45a-aio-ordered)**,
which commits it.

Status: **frame being printed; FC ordered.** No motors, props, VTX or battery selected.

## Flight controller — HDZero Gamma 45A AIO (ordered)

One of a **pair ordered 2026-09-01**, the other going to the
[Carnage 4.5](../carnage-45/README.md) — full spec table is
[on that page](../carnage-45/README.md#flight-controller--hdzero-gamma-45a-aio-ordered). What
matters here:

| Gamma feature | Fit against this frame |
|---|---|
| **25.5 × 25.5 mm AIO**, 33×33 mm board | ✅ the frame takes a 20×20 stack **or** a 25.5×25.5 AIO |
| **8.4 g** | ✅ cheap against the sub-250 g setup, which sits at ~250 g TOW already |
| **Built-in 2.4 GHz ELRS** | ✅ saves an RX and its wiring — meaningful on this frame's weight budget |
| **3–6S**, 45 A AM32 | ✅ covers all three of the designer's setups (4S sub-250, 6S freestyle, 4S Li-Ion long range) |
| **8 V / 3 A protected VTX BEC** | ✅ regulated digital-VTX power |

### ⚠ But the VTX bay is the open problem

The frame's VTX provision is **the BetaFPV Pavo 20 chassis** — designed around **DJI O3, Caddx Vista
and RunCam Link**. The Gamma is an **HDZero-branded, HD-ready** board and the rest of the fleet is
[consolidating on HDZero](../README.md#video-ecosystems). Those don't automatically meet:

- The Gamma's 8 V VTX rail is generic — it will feed an HDZero VTX or an O3 equally.
- But **an HDZero VTX does not drop into the Pavo 20 chassis**. Either fit an O3/Vista-class unit
  (fragmenting the video ecosystem further) or mount an HDZero VTX another way — the community
  **[Aether Moonlight VTX mount](https://makerworld.com/en/models/1609574-aether-moonlight-mount)**
  is the obvious lead, and it's already linked below.

**Resolve this before buying a VTX**, because it decides which ecosystem this aircraft joins.

Print profile in use: **Frame V1.1** (`profileId-466821`) — 8.9 h, 2 plates, 4.9★ from 354 ratings.

## Why it's cheap

The claim holds up: **one roll of filament prints up to 20 copies**, and the frame is **unibody** —
printed in one piece, no assembly, no CF order, no hardware kit for the frame itself. That is the
whole appeal here. A crash costs a reprint.

## Frame spec

| Parameter | Value |
|---|---|
| Design | **Aether 以太 4** by Dr. J. Ma; released 2024-07-15 |
| Type | Fully 3D-printed **unibody** — one piece, no frame assembly |
| Class | 4" / 4.5" props (**4.5" max**) |
| Layout | **True X** — "not a DC nor squashed X", good pitch authority |
| Motor pitch | ~**185 × 185 mm**, sweep angle **28°** |
| Frame weight | **~40 g @ 2 walls** |
| FC / ESC | **20×20 stack** or **25.5×25.5 AIO** |
| Motors | **9×9 mm** or **12×12 mm** pattern |
| VTX | anything the **BetaFPV Pavo 20 chassis** supports — DJI O3, Caddx Vista, RunCam Link |
| Prop view | none, in DJI O3 wide-angle |

## ⚠ It is not a pure print — one part must be bought

> "the O3 unit and VTX **sit inside the BetaFPV PAVO 20 VTX chassis which is NOT provided in the
> print file**. You need to purchase one of this to complete the drone."

The designer notes there may be printed alternatives but he hasn't tested any. Worth knowing before
treating this as a zero-cost airframe — though it only matters if a build actually happens.

✅ **Resolved 2026-08-17 — a couple of BetaFPV cages are on hand**, so this isn't a purchase. Nothing
to buy for the airframe.

## Print settings

Straight from the model page:

- **The designer says print without infill** — *"infill add little to no strength in this frame."*
  Wall count is his strength knob (2 walls ≈ 40 g, 3 walls for freestyle). ⚠ **But see the infill
  cost below before deciding** — this is a real choice, not a settled one.
- **Don't re-orient.** The model is *"optimized for the placement and rotation in the print file."*
- **Keep the painted supports.** They're deliberate — *"the supports in the print file are painted and
  are nessessary for better edges and surface finishs."*
- **PLA is fine.** Rigid filament preferred over flexible; **carbon-reinforced offers greater
  advantages**. The designer's own photos are on Bambu Lab Grow PLA.
- ⚠ **For heavy freestyle or racing, a high-temperature filament is essential** — otherwise heat
  building up under the motors softens the plastic and the motor screws work loose.

_(The MakerWorld BOM links Bambu **PPS-CF** as the filament, but the description is clear that PLA is
perfectly adequate for normal use. Don't read the BOM as a requirement.)_

Other profiles published alongside the frame: **Travel Box** (6.1 h), **GPS Holder** (49 min), **TPU
Antenna mount** (15 min).

### ⚠ Infill vs. the weight budget — measured 2026-08-17

Own figures from the slicer, against the designer's ~40 g baseline (2 walls, no infill):

| Infill | Frame weight | Δ vs. baseline |
|---|---|---|
| 0 % (designer's spec) | ~40 g | — |
| **5 %** | **50 g** | **+10 g** |
| **10 %** | **55 g** | **+15 g** |

⚠ **This effectively rules infill out of the sub-250 g setup.** The designer's own sub-250 build lands
at **TOW ~250 g** with the 40 g frame — it is already at the ceiling, so +10–15 g of frame puts it
over with nothing else changed. Infill is affordable on the **freestyle (6S)** and **long-range**
configs, where 250 g isn't the constraint.

Two things worth weighing before spending the grams:

- **Walls are the more efficient way to buy stiffness.** In a frame arm loaded in bending, the
  material furthest from the neutral axis does nearly all the work — which is the perimeter, not the
  core. That's the mechanical reason behind the designer's "infill adds little to no strength" line,
  and why his freestyle recommendation is **3 walls** rather than infill. Going 2 → 3 walls will also
  add weight, but buys more stiffness per gram than core infill does.
- **Infill isn't worthless though** — it resists local crushing and skin buckling, which is a real
  failure mode around motor mounts and stack standoffs where a hollow shell can dimple under
  clamping load. If the goal is specifically "the motor mounts feel flexy," a small amount of infill
  (or more top/bottom layers) targets that better than it targets overall arm rigidity.

**Suggested approach:** try **3 walls / 0 % infill** before reaching for infill — it's the
designer-sanctioned path, and worth a weigh-in to see what it actually costs against the 50 g / 55 g
figures above.

## ⚠ Build cautions

No longer hypothetical — these now apply to a build in progress:

- **The frame is vibration-sensitive.** *"Please ensure that your motors and props are well balanced
  dynamically."* This is called out as the key to clean flight.
- **Plastic bounces motor screws out.** Tighten before every flight, or use screw locker.
- **Avoid sustained high load** — heat under the motors causes loose screws and vibration.
- Betaflight **4.5+** flies it well on **default tuning**. If there's wobble or the motors run warm,
  the designer's starting point is lower D gains and heavier gyro/D-term filtering:

```
set gyro_lpf1_static_hz = 0
set gyro_lpf2_static_hz = 400
set dyn_notch_count = 2
set dyn_notch_q = 500
set gyro_lpf1_dyn_min_hz = 200
set gyro_lpf1_dyn_max_hz = 400

set dterm_lpf1_dyn_min_hz = 60
set dterm_lpf1_dyn_max_hz = 120
set dterm_lpf1_static_hz = 60
set dterm_lpf2_static_hz = 120
set d_pitch = 36
set d_roll = 31
set d_min_roll = 23
set d_min_pitch = 27
set simplified_d_gain = 80
set simplified_dterm_filter_multiplier = 80
```

## Designer's setup examples

Useful if a build ever gets specced — note the frame covers three quite different roles depending on
wall count and motor choice:

| Setup | Walls | Motor | Prop | Battery | Time |
|---|---|---|---|---|---|
| **Sub-250 g** (designer's own) | 2 | Darwin 1504 KV2300 or HLG 1404 KV2800 | GemFan 4525-3 (4.5") or 4024-2 (4") | Boshi LiPo P7 850 mAh 4S, ~93 g | ~12 min cruise / ~6 min freestyle, TOW ~250 g |
| **Freestyle** | **3** | 2006 KV1900 or 2204 KV1800 | GemFan 4525-3 | 6S 850–1300 mAh | — |
| **Long range** | — | 1404 KV2800 | GemFan 4525-3 or 4" low-pitch 2-blade | **4S 3000 mAh 18650 Li-ion** | **>30 min** cruise |

⚠ **The long-range setup overlaps the [Reliant V2 Y6](../f121-reliant-v2/README.md)** — 1404 motors,
4"-class props, 4S Li-Ion, 30+ min. If that build stalls or disappoints, this is a far cheaper way to
try the same idea. Worth keeping in mind rather than treating the two as unrelated.

## ⚠ License

Changed **2024-10-14** to a MakerWorld **Standard Digital License** — the model is MakerWorld
exclusive, and redistributing it or derivatives on any other platform (free or paid) is prohibited.
Copies downloaded before that date keep the original CC-BY terms. So: don't mirror the files into
this repo — link to the model page.

## Status

- [x] BetaFPV cage sorted — a couple on hand, nothing to buy
- [x] ~~Decide whether it stays a print or becomes a build~~ — **it's a build**; FC ordered 2026-09-01
- [x] **FC ordered** — HDZero Gamma 45A AIO, 25.5×25.5, 8.4 g, built-in ELRS
- [ ] **Pick which of the three setups this is** (sub-250 g / 6S freestyle / 4S Li-Ion long range) —
      it drives wall count, motors, props and battery together
- [ ] **Decide wall count / infill** — see the table above; 3 walls @ 0 % is worth trying first.
      ⚠ if it's the sub-250 g setup, infill is ruled out
- [ ] Frame printed (profile **Frame V1.1**, `profileId-466821`)
- [ ] Weigh the printed frame against the 40 / 50 / 55 g figures
- [ ] **Resolve the VTX bay** — Pavo 20 chassis is O3/Vista-shaped; an HDZero VTX needs another mount
- [ ] Motors (9×9 or 12×12), props, battery selected
- [ ] Bind the Gamma's built-in ELRS to `dwdrones`
- [ ] Assembled

## Log

- **2026-09-01** — **It became a build.** An **HDZero Gamma 45A AIO** was ordered for it — one of a
  pair, the other for the [Carnage 4.5](../carnage-45/README.md). Good fit on paper: 25.5×25.5 is one
  of the two patterns this frame takes, 8.4 g is cheap against a frame whose sub-250 g setup already
  sits at ~250 g TOW, and the **built-in ELRS** saves an RX and its wiring. New open question
  recorded: **the frame's VTX provision is the BetaFPV Pavo 20 chassis**, which is shaped for
  DJI O3 / Caddx Vista / RunCam Link — so pairing it with HDZero (the direction the rest of the
  fleet is moving) needs a different mount, with the community **Aether Moonlight** mount as the
  lead. That decision picks this aircraft's video ecosystem, so it comes before buying a VTX.
- **2026-08-17** — Two updates. **BetaFPV cages are already on hand**, so the Pavo 20 chassis is a
  non-issue and the airframe costs nothing but filament. Sliced the frame at different infills and
  recorded the cost: **50 g at 5 %, 55 g at 10 %** against the designer's ~40 g baseline. That's
  enough to matter — the designer's sub-250 g setup already sits at ~250 g TOW on a 40 g frame, so
  **infill and sub-250 g are mutually exclusive here**, though infill is affordable on the 6S
  freestyle or long-range configs. Noted that walls buy more stiffness per gram than core infill for
  parts loaded in bending, which is the reason behind the designer's advice — but that infill does
  help against local crushing near motor mounts and standoffs, so it isn't a pure loss.
- **2026-08-17** — Recorded. Printing the **Frame V1.1** profile; no build planned. Captured the
  print settings (no infill by design, don't re-orient, keep the painted supports), the vibration /
  motor-screw warnings, the designer's Betaflight filter starting point, and the three published
  setup configurations. Noted the license moved to MakerWorld-exclusive in Oct 2024.

## Links

- **Model + print profiles** — BM Aether 4, MakerWorld:
  <https://makerworld.com/en/models/541413-bm-aether-4-the-4-inch-unibody-fpv-drone-frame>
- Profile in use — **Frame V1.1**:
  <https://makerworld.com/en/models/541413-bm-aether-4-the-4-inch-unibody-fpv-drone-frame#profileId-466821>
- **BM Aether 4 XL** — the 5–6" version of the same design:
  <https://makerworld.com/en/models/593258>
- Aether Moonlight VTX mount (by GiBi):
  <https://makerworld.com/en/models/1609574-aether-moonlight-mount>
- Breeze Model Pilot Group (designer's community):
  <https://www.facebook.com/groups/1165452208203912>
- Required chassis — BetaFPV Pavo 20:
  <https://betafpv.com/collections/brushless-frame/products/pavo20-brushless-whoop-frame>
