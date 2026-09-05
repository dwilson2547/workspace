---
tier: reference
domain: drones
---

# 3" freestyle — "Angel30"

**Built and flying.** A 3", 4S freestyle quad on the **Angel30** frame.

✅ **This page was a placeholder for months** — the build predated this folder, so nothing was
written down. **It is now filled in** (2026-09-01), recovered from the web-bot conversation the build
was originally discussed in. The only gap left is the exact battery.

✅ **There is one 3" build, not two.** Worth stating explicitly, because the ambiguity was real: the
airframe went through a **complete video-system swap** part-way (analog → HDZero), which reads like
two builds in an order history. It is one aircraft.

Status: **flying.** One live change: the **Nano90 camera is being replaced** — see
[camera](#-camera--it-came-in-the-box-and-thats-the-problem).

## Spec

| Item | Part | Status |
|------|------|--------|
| Frame | **Angel30** — 3", 149 mm wheelbase, carbon | **fitted** |
| Flight controller / ESC | **SpeedyBee F405 AIO V2** — F405 + 35/40 A ESC, 25.5×25.5 | **fitted** |
| Motors | ×4 — **iFlight XING 1404, 4600 KV** | **fitted** |
| Props | **HQProp T3X2X3** — 3", 2.0 pitch, tri-blade, 1.5 mm T-mount | **fitted** |
| Battery | **4S 650 mAh** — inside the frame's 3–4S 550–850 mAh range | **in use** |
| RC link | **RadioMaster RP3 ELRS** on **UART6**, `dwdrones` | **fitted** |
| FPV antenna | **RushFPV Cherry** 5.8 GHz RHCP (also on the [Reliant Y6](../f121-reliant-v2/README.md)) | **fitted** |
| Video / FPV | **HDZero Freestyle V2 VTX** on **UART3** (MSP DisplayPort, HD OSD) + **Nano90** camera | **fitted** — camera being replaced |
| _(superseded)_ | ~~RushFPV Tank Ultimate Mini + Caddx Ratel 2~~ — analog, **removed; now spares** | see [inventory](inventory.md) |

Parts: [`inventory.md`](inventory.md).

## Frame — Angel30

| Parameter | Value |
|---|---|
| Wheelbase | **149 mm** (3" class) |
| Carbon | **3.5 mm** arms · **1.5 mm** top and side plates |
| Frame kit weight | **~56.6 g** |
| FC mounting | **20×20 or 25.5×25.5** — the SpeedyBee is 25.5×25.5 |
| Recommended motors | 1306 / 1406 / 1408 / 1506 / 1507 — **the fitted 1404 sits in this band** |
| Recommended ESC | 20–40 A |
| Recommended battery | **3–4S, 550–850 mAh** |
| Included printed parts | camera mount, arm protectors / landing skids |

## Flight controller — SpeedyBee F405 AIO V2

| Parameter | Value |
|---|---|
| MCU / gyro / baro | STM32F405 / **ICM-42688P** / SPA06-003 |
| ESC | **35 A** (standard) / **40 A** (CNC) per channel, **Bluejay JH-40 48 kHz** |
| Input | **3–6S** |
| **BEC outputs** | **4V5 @ 1 A · 5 V @ 1.5 A · 9 V @ 1.5 A** |
| UARTs | **4** — UART3, UART4, UART5, UART6 (+SBUS) |
| Blackbox / extras | 8 MB · Bluetooth BLE · USB-C |
| Size / mounting | 33 × 33 × 7 mm, **25.5 × 25.5 mm** |
| Weight | **8.9 g** |

### Port map

| Port | Device |
|---|---|
| **UART3** | **HDZero Freestyle V2 VTX** — MSP DisplayPort, HD OSD |
| **UART6** (+SBUS) | **RP3 ELRS receiver** |
| UART4, UART5 | **spare** |

Two spare UARTs is comfortable — notably better than the Y6's Specter, which has
[only three in total](../f121-reliant-v2/README.md#flight-controller--hglrc-specter-6-in-1-aio) and
no room for a GPS.

### ⚠ Check which pad the VTX is powered from

This board has a **9 V / 1.5 A** BEC, and the Freestyle V2's range is **7–25 V**, so 9 V is in spec —
this is a far more forgiving pairing than the one that
[killed the Y6's VTX](../f121-reliant-v2/README.md#-vtx-failure--the-video-power-pad-is-pack-voltage).
But the current budget is tighter than the voltage:

> The Freestyle V2 draws **6–15 W**. At 9 V that is **0.67–1.67 A** — and the top of that range
> **exceeds the 9 V BEC's 1.5 A rating.**

The 15 W figure is the unlocked-1 W case, not the 25/200 mW modes it will normally run at, so this is
a headroom question rather than an active fault. Two things follow:

- **Confirm which pad it's actually on.** If it's on 9 V and the VTX ever gets unlocked to 1 W, that
  BEC is the limit — expect brownouts or a hot regulator before you expect a video problem.
- **Pack voltage is legitimately in spec here** (4S = 16.8 V, inside 7–25 V), unlike on the Whoop V2.
  Running the VTX from VBAT sidesteps the BEC ceiling entirely and is the safer wiring if 1 W is
  wanted.

## Motors and props — iFlight XING 1404 4600 KV on T3X2X3

**Settled 2026-09-01.** Same motor platform as the [Reliant Y6](../f121-reliant-v2/README.md), which
runs the **3800 KV** of the same family. **Both were bought on Amazon for availability**, not chosen
on spec — it was what was in stock without a month of AliExpress shipping — so read the KV as what
was buyable rather than as a tuning decision.

| Parameter | Value |
|---|---|
| Motor | **iFlight XING 1404, 4600 KV** ×4 |
| Cell count | **2–4S** — this build runs at its rated ceiling |
| Published current (XING2 4600 KV) | **17.99 A peak / 287.8 W**, 159 mΩ interphase |
| Motor weight | 9.1 g incl. wire (8.5 g bare) |
| Prop | **HQProp T3X2X3** — 3", **2.0 pitch**, **tri-blade**, polycarbonate |
| Prop weight / hub | **1.2 g** · 9.8 mm dia × 4.5 mm thick |

### The low pitch is what makes this combination sensible

High KV on 4S sounds alarming in isolation, but **T3X2X3 is a low-pitch prop** — 2.0 pitch on a 3",
where 3.0 is the common freestyle pitch. Pitch is what loads the motor, so a high-KV/low-pitch
pairing spins fast while keeping current down, which is the standard way a 3" 4S setup is built.
**This is a coherent combination, not an over-propped one.**

⚠ Earlier drafts of this page flagged the motors as a heat risk on KV alone; with the prop known,
that reads as overstated. A hand temp-check after the first pack is still cheap and worth doing —
this is the higher KV of the two builds and, unlike the Y6, has no six-motor load-sharing — but it's
a sanity check, not a concern.

### ⚠ Shaft size — 1.5 mm across both builds

T3X2X3 ships in **1.5 mm and 2 mm** T-mount variants, and the XING 1404 has been made in **1.2 mm**
(original) and **1.5 mm** (XING2) shafts. Since these props are fitted, this is the **1.5 mm**
pairing — the same shaft as the [Y6's Nazgul T4030](../f121-reliant-v2/README.md#motors-and-props--at-the-top-of-the-motors-rated-range).
**Buy props to the 1.5 mm shaft for both aircraft**, and don't order T3X2X3 without checking which
variant the listing is.

## Video — analog first, then HDZero

**The build was originally analog and was converted.** Recorded because it is the reason the parts
history looks like two aircraft, and because it left usable gear on the shelf:

| Generation | VTX | Camera | Status |
|---|---|---|---|
| **Original** | **RushFPV Tank Ultimate Mini** (7–36 V, 20×20, 800 mW, MMCX) | **Caddx Ratel 2** | removed — now [unassigned spares](../inventory/shared-gear.md) |
| **Current** | **HDZero Freestyle V2** (UART3, MSP DisplayPort) | **Nano90** | fitted |

The switch also changed how the OSD works: analog drew the OSD onto the video signal at the FC, HD
runs **MSP DisplayPort** — the goggles render the OSD, and the FC only sends text.

| Parameter | HDZero Freestyle V2 VTX |
|---|---|
| Input voltage | **7 – 25 V (2S–6S)** — a wide, forgiving range |
| Power | 25 mW / 200 mW factory-limited, up to 1000 mW unlocked |
| Video modes | 540p90, 540p60, 720p60, 1080p30 |
| Consumption | 6–15 W |
| Size / mounting | 29 × 30 × 14 mm, **20 × 20 mm M2** |
| Weight | 22.3 g |

Note the **20×20 mounting** — this is the one HDZero VTX in the fleet that is *not* 25.5×25.5, so it
does not swap with the Whoop V2 or drop onto the Carnage's top plate.

### ⚠ Camera — it came in the box, and that's the problem

The **Nano90** is fitted and the image is judged poor. **It was never chosen** — the *HDZero
Freestyle V2 VTX Kit* ships with one:

> **Kit contents:** 1× Freestyle V2 VTX · **1× Nano 90 camera (with 19×19 mount)** · 1× HDZero RHCP
> antenna · 1× 120 mm MIPI cable · power cable · SA cable · mounting bars, screws, tape.

So the camera arrived as a bundle component, and the specs explain the disappointment: it is a
**1/3" sensor** in a lineup where the current parts are 1/2", and its whole selling point is
**540p @ 90 fps** — frame rate for racing, bought at the cost of resolution and low-light. This is a
bundled-part problem, not a bad purchase.

✅ **Two useful consequences:** the kit's **120 mm MIPI cable** and **RHCP antenna** are already on
hand (the antenna superseded by the Cherry), and the Nano90 ships **with a 19×19 mount** — so the
frame's camera bay has already accepted a 19 mm-mounted camera, which widens the replacement options
below.

| Camera | Sensor | Modes | FOV (D/H/V) | Weight |
|---|---|---|---|---|
| **Nano90** _(fitted)_ | **1/3"** | **540p90**, 720p60 (4:3) | 160° / 127° / 92° | 5.2 g |
| **Nano V3** | **1/2"** | 720p60 (4:3) | 155° / 126° / 94° | **2.2 g** |
| **Micro V3** | **1/2"** | 1080p30 native, 720p60 oversampled (**16:9**) | 157° / 133° / 72° | 7.5 g |

- **Nano V3 is the like-for-like swap** — same nano form factor, bigger sensor, sharper optic, less
  than half the weight. It is also **already proven in the fleet**: the same camera is on the
  [Reliant Y6](../f121-reliant-v2/README.md). Losing 90 fps is the trade, and 90 fps is a racing
  feature this aircraft isn't using.
- **Micro V3 is the image-quality answer** — native 16:9, best low-light and contrast in the lineup.
  It is a **19 mm** camera, and the Nano90 already sits in a **19×19 mount** on this frame, so the
  bay is likelier to take it than it first appeared. The [CL35 runs one](../cinelog35-tof/README.md),
  so its behaviour in this fleet is known. **Measure before buying** — the mount matching doesn't
  guarantee the body depth fits the Angel30's printed camera mount.

Both cameras use the same MIPI cabling, and there are
[spare MIPI cables on hand](../inventory/bom.md) in 40/80/120 mm plus the kit's own 120 mm.

## Relationship to the Carnage 4.5

**Resolved 2026-09-01 — they don't actually overlap much.** The open question on
[that page](../carnage-45/README.md) assumed two comparable freestyle builds; with this one's spec
now recorded, the split is clear:

| | **Angel30** (this) | **Carnage 4.5** |
|---|---|---|
| Class | 3", 149 mm | 4.5" |
| Design intent | freestyle, **no weight ceiling** | **sub-250 g** (Sub250gFPV design) |
| Power | **4S 650 mAh, XING 1404 4600 KV** — high RPM, low pitch | 1804/2004, sized to the 250 g budget |
| Registration | over 250 g | the whole point is staying under |

So this is the small hot freestyle quad and the Carnage is the light-class one. The remaining
question is really about the Carnage's own sub-250 g commitment, not about these two competing.

## Status

- [x] Parts received
- [x] Assembled
- [x] ELRS bound (`dwdrones`) — RP3 fitted
- [x] Motor order + direction verified
- [x] First flight
- [x] **Airframe parts list recovered** (2026-09-01) — Angel30 frame, SpeedyBee F405 AIO V2,
      iFlight XING 1404, UART map
- [x] Converted analog → HDZero; MSP DisplayPort on UART3
- [ ] **Replace the Nano90 camera** — measure the frame's camera bay, then pick **Nano V3** (14 mm,
      like-for-like) or **Micro V3** (19 mm, best image; the bay already takes a 19×19 mount)
- [ ] **Confirm which pad powers the VTX** — 9 V BEC is only 1.5 A against the VTX's 6–15 W; VBAT is
      also in spec here
- [x] Motors settled — **iFlight XING 1404 4600 KV**, same platform as the Y6
- [x] Props recorded — **HQProp T3X2X3** (3", 2.0 pitch, tri-blade, 1.5 mm shaft)
- [x] Battery recorded — **4S 650 mAh**
- [ ] Hand temp-check after a pack — a sanity check, not a concern (the low-pitch prop suits the KV)
- [x] Analog spares identified — **RushFPV Tank Ultimate Mini** (7–36 V, 20×20, MMCX) + Caddx Ratel 2
- [ ] Reassign or retire the analog spares (no analog goggles in the fleet)
- [ ] ⚠ **Confirm the fitted Cherry antennas are the U.FL variant** — the bundled one is MMCX and
      won't fit either HDZero VTX

## Build log

- **2026-09-01** — **Analog spare identified, and the Cherry antenna's origin found.** The spare VTX
  is a **RushFPV Tank Ultimate Mini** — the Amazon listing is branded **"SoloGood"** (a reseller) but
  **the PCB silkscreen says RushFPV**, which settles it. **7–36 V (2–8S)**, 20×20, MMCX,
  PIT/25/200/500/800 mW, so it's genuinely easy to reuse on anything.
  ✅ **The "Cherry" antennas on both aircraft are RushFPV Cherry**, and they entered the fleet
  **bundled with this VTX** rather than as a separate purchase — 5.8 GHz RHCP, 1.2 dBi, 98 %
  efficiency, 7.5 g.
  ⚠ **New catch: the bundled Cherry is MMCX, and both HDZero VTXs are U.FL.** So whatever is fitted
  to the two aircraft must be the **U.FL** variant, and the MMCX one can't move onto an HDZero VTX
  without an adapter — it should stay with the Rush Tank. Worth confirming which variant is on each
  aircraft. Also noted a **Cherry 2** exists (1.8 dBi avg, 99 % efficiency, ~30 % smaller) as a cheap
  future upgrade.
- **2026-09-01** — **Propulsion fully settled; the page has no unknowns left.** Motors are
  **iFlight XING 1404 4600 KV** (the 4800 figure was a typo, so the KV discrepancy flagged earlier
  is closed), props are **HQProp T3X2X3**, battery is **4S 650 mAh** — inside the frame's own
  3–4S 550–850 mAh recommendation.
  **Walked back the heat warning.** With the prop known, the earlier "4600 KV on 4S is a hot setup"
  framing reads as overstated: **T3X2X3 is a 2.0-pitch tri-blade**, low pitch where 3.0 is the
  freestyle norm, and pitch is what loads a motor. High KV with low pitch is the standard way a 3"
  4S build is put together — coherent, not over-propped. A temp-check stays on the list as a cheap
  sanity check rather than a concern.
  New cross-build detail: T3X2X3 ships in **1.5 mm and 2 mm** T-mount variants and the XING 1404 has
  existed in 1.2 mm and 1.5 mm shafts, so this is the **1.5 mm** pairing — **the same shaft as the
  Y6's Nazgul T4030**. Both aircraft buy props to 1.5 mm.
  Sourcing rationale recorded: **both craft's motors were Amazon purchases for availability**, not
  spec choices — AliExpress lead time was ~a month.
- **2026-09-01** — **Page filled in from the web-bot conversation the build was discussed in**, which
  closed nearly every gap left below. The aircraft is the **"Angel30"**: **Angel30** frame (149 mm,
  3.5 mm arms, ~56.6 g, takes 20×20 or 25.5×25.5), **SpeedyBee F405 AIO V2** (F405, ICM-42688P,
  35/40 A Bluejay, 3–6S, 8.9 g), **1404** motors (KV corrected in the entry above), **4S**. Port map recorded: **ELRS on
  UART6, HDZero VTX on UART3** as MSP DisplayPort, with **UART4/5 spare** — a more comfortable
  budget than the Y6's three-UART Specter.
  **Established it's one aircraft, not two.** The confusion is explained: the build **started analog
  (Rush Tank VTX + Caddx Ratel 2) and was converted to HDZero**, so the parts history looks like two
  machines. The analog pair is now unassigned spares.
  **The Nano90 mystery is solved — it was never chosen.** The *HDZero Freestyle V2 VTX Kit* ships
  with a Nano90 (plus a 120 mm MIPI cable and an RHCP antenna, the latter superseded by the Cherry),
  so the poor image is a bundled-part outcome. Useful side-finding: the bundled camera comes **in a
  19×19 mount**, meaning the bay has already accepted 19 mm and the **Micro V3** is a more plausible
  upgrade than assumed.
  New concern recorded: the SpeedyBee's **9 V BEC is 1.5 A** while the Freestyle V2 draws **6–15 W**
  — at 9 V the top of that range is 1.67 A, over the rail. Not a live fault at 25/200 mW, but it
  caps unlocking to 1 W unless the VTX runs from VBAT (which is in spec here, 7–25 V).
  Remaining unknowns are small: prop model, battery capacity, motor brand.
- **2026-09-01** — **Flying.** Recorded the video and RC half of the build for the first time:
  **HDZero Freestyle VTX** (7–25 V, 20×20 mount — the only non-25.5×25.5 HDZero VTX in the fleet)
  with a **RunCam HDZero Nano90** camera, an **RP3** on `dwdrones`, and a **Cherry** antenna shared
  with the [Reliant Y6](../f121-reliant-v2/README.md).
  **The Nano90's image is judged poor and it's being replaced.** The specs back that up — it is a
  **1/3" sensor** bought for **540p90**, a racing frame-rate feature this aircraft doesn't use, in a
  lineup where the current parts are 1/2". Wrote up the swap: **Nano V3** is the like-for-like choice
  (bigger sensor, sharper, 2.2 g vs 5.2 g, already proven on the Y6), **Micro V3** is the
  image-quality choice but needs a 19 mm bay. Gated on measuring the frame — which is itself still
  unrecorded.
- **2026-08-17** — Documented for the first time. **No progress: parts still in transit.** The build
  predates this folder, which is why the spec above is empty — it was ordered without being written
  down anywhere.
