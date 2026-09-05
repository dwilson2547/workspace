# Bill of materials

The master BoM for the drone hobby — every craft, radio, FPV, battery, and spare with its reorder
link. Per-craft on-hand tracking lives in each craft's `inventory.md`; this is the flat purchase
list they draw from.

## Craft

- **X500 v2** (eBay) — PX4 Development Kit, Pixhawk 6C / M10 GPS / 915 MHz telemetry:
  <https://www.ebay.com/itm/178291568690>
- **Pavo20 Pro II** (Amazon, `B0GL2LDKXD`) — BNF, F4 2-3S 20A AIO, LAVA 1104 7200KV, COB LED,
  O4/O4 Pro compatible: <https://www.amazon.com/dp/B0GL2LDKXD>
- **Pavo Femto** (Amazon, `B0DXT4BFCQ`) — BNF, 75mm micro cinewhoop, 2S, O4 HD bracket, ELRS:
  <https://www.amazon.com/dp/B0DXT4BFCQ>

## Radio & charging

- **RadioMaster TX16S Mark II** (ELRS TX), Amazon `B09XWSNTR8`: <https://www.amazon.com/dp/B09XWSNTR8>
- **RadioMaster RP3 ELRS receiver** (for X500), Amazon `B0BGBKG635`: <https://www.amazon.com/dp/B0BGBKG635>
- **HOTA D6 Pro** smart charger, dual channel 15A / AC 200W, Amazon `B0FLXJY5M3`:
  <https://www.amazon.com/dp/B0FLXJY5M3>

## Frames — cncdrones.com / Cncmadness (ordered 2026-08-17)

Both bought in one order. **Both are cut-to-order** — Cncmadness sells the cutting service, not
stock. See [`f121-reliant-v2/`](../f121-reliant-v2/README.md) and
[`carnage-45/`](../carnage-45/README.md).

- **Reliant V2 — Long range Y6**, part **F121**, **$29.00**, ~1–3 days to cut:
  <https://cncdrones.com/reliant--long-range-y6.html>
  - Open-source design by **eyefly**, CC BY-NC. **3D print files (TPU camera + GPS mounts)**:
    <https://www.thingiverse.com/thing:4845387> — print at 0.2 mm, 20 % infill, TPU.
  - Designer's build: **1404 motors, 4" props, 3S Li-Ion**, 16–20 min. Design intent is long range,
    **not** sub-250 g.
  - Hardware: M2 spacer bolts/screws — full list on the project page. **Aluminium spacer bolts** to
    save weight. Source used by the designer: <https://www.aliexpress.com/item/32831145268.html>
- **V2 Carnage 4.5"**, part **C169**, **from $39.00**, ~6–10 business days:
  <https://cncdrones.com/v2-carnage-45.html>
  - Design by **Phil (Sub250gFPV)**. ⚠ **Not open source** — no files supplied or modifiable.
  - 3 mm/4 mm bottom plate, 2 mm top, 15/20/25 mm standoffs; **12×12 motor pattern (1804/2004)**;
    **4.5" props**, Gemfan 4523-3 recommended; **14 mm HD / 19 mm analogue** camera.
  - Top plate takes **HDZero 25.5×25.5**, WalkSnail 25.5×25.5, Caddx Vista 20×20, Sixty9 20×20,
    HappyModel Fyujon, VTX 16×16.
  - ⚠ **3D printed parts are NOT supplied** — get them from the designer:
    <https://www.thingiverse.com/sub250gfpv/designs>

### FC for the Y6

- **HGLRC Specter 6-in-1 AIO — F722 FC + 40 A ESC**, **$99.99**, getfpv SKU 23366:
  <https://www.getfpv.com/hglrc-specter-6-in-1-aio-f722-fc-40a-esc.html>
  - **6 motor outputs** — the part that made the Y6 build possible. **13.2 g** (per the manual; the
    listing's 14 g is wrong), 34×48 mm, 25.5×25.5 M2, **8.4–26.1 V** (2S–6S), ICM42688P, 16 MB
    blackbox. ✅ **Ships defaulted to the Y6 mixer** (options: Y6, HEX X).
  - ⚠ **Only 3 UARTs**, and it ships a vendor Betaflight target (`HGLRCF722AIO_X6` 4.4.3) — don't
    assume stock Betaflight/INAV/ArduPilot will run on it.
  - ⛔ **Its digital-video power pad is labelled `7.4–26.4 V` — raw pack voltage.** This destroyed an
    HDZero Whoop V2 (3–12.6 V) on 4S. A `5V` pad sits on the same header; BEC currents are not
    published by HGLRC.
  - **Manual v1.0** (in-repo, Chinese then English):
    [`../docs/manuals/HGLRC Specter F722 40A 6-in-1 AIO Manual v1.0.pdf`](../docs/manuals/HGLRC%20Specter%20F722%2040A%206-in-1%20AIO%20Manual%20v1.0.pdf)

### VTX power for the Y6

- **Matek Micro BEC**, 6–60 V in → **5 V / 9 V / 12 V** out (default 5 V; 9 V and 12 V by solder
  jumper). 2.8 A @5 V / 2.6 A @9 V at 4S input, 3 A max; **OCP with hiccup + thermal shutdown**;
  18×15×4.5 mm, **2 g**: <https://www.getfpv.com/mateksys-micro-bec-6-60v-to-5v-9v-12v.html>
  - Bought to power the replacement Whoop V2 off its own rail instead of the Specter's pack pad.
  - ⚠ **Leave at the 5 V default or jumper to 9 V — never 12 V.** 12 V is inside the Whoop V2's
    3–12.6 V range by only 0.6 V.

### Motors & props for the Y6

- **iFlight XING 1404 3800 KV** ×6 — 9.1 g ea, **2–4S**, 11.8 A / 174.6 W max continuous, 9N12P,
  14×4 mm stator: <https://www.getfpv.com/iflight-xing-1404-3800kv-4600kv-7000kv-unibell-toothpick-motor-blue-camo-1pc.html>
  - ⚠ **Buy to the shaft, not the name** — the original XING 1404 is a **1.2 mm** shaft, the XING2
    1404 is **1.5 mm**. The T4030 props below are 1.5 mm.
- **iFlight Nazgul T4030** ×6 — 4×3.0 2-blade, **T-mount, 1.5 mm** hub:
  <https://www.getfpv.com/iflight-nazgul-t4030-2-blade-propeller-set-of-4.html>

## Custom build — "Angel30" 3" freestyle

Parts for the [3" freestyle](../freestyle-3in/README.md). Recovered 2026-09-01; **purchase links
were never recorded** — recover them from order history if reordering.

- **Frame — Angel30** (UAngel), 3", **149 mm** wheelbase, ~56.6 g kit. 3.5 mm arms, 1.5 mm top/side
  plates; **20×20 or 25.5×25.5** FC; recommended **1306–1507** motors, 20–40 A ESC, **3–4S
  550–850 mAh**. Ships with printed camera mount and arm protectors/landing skids.
  Listing: <https://www.aliexpress.com/item/1005009607346993.html>
- **FC — SpeedyBee F405 AIO V2**, F405 + ICM-42688P + SPA06-003, **35 A** std / **40 A** CNC per
  channel, Bluejay JH-40 48 kHz, **3–6S**, **4 UARTs**, 8 MB blackbox, BLE, 33×33×7 mm,
  **25.5×25.5**, **8.9 g**: <https://www.getfpv.com/speedybee-f405-v2-aio-f405-fc-40a-3-6s-bluejay-esc-25-5x25-5.html>
  - **BECs: 4V5 @ 1 A · 5 V @ 1.5 A · 9 V @ 1.5 A.** ⚠ The 9 V rail is the VTX rail and the
    Freestyle V2 peaks at **1.67 A** there — voltage is fine, current is the limit.
  - ArduPilot docs (for the non-V2 sibling): <https://ardupilot.org/copter/docs/common-speedybeef405aio.html>
- **Motors — iFlight XING 1404, 4600 KV** ×4 — same platform as the Y6's 3800 KV. **Bought on Amazon
  for availability** (AliExpress lead time ~1 month), so the KV reflects stock rather than a spec
  choice. 2–4S, 9.1 g ea; XING2 4600 KV listed at 17.99 A peak / 287.8 W.
  Amazon (XING 1404, 3800/4600/7000): <https://www.amazon.com/dp/B083ZWWPNC>
- **Props — HQProp T3X2X3** ×4 — 3", **2.0 pitch**, tri-blade, polycarbonate, 1.2 g, hub 9.8×4.5 mm.
  ⚠ **1.5 mm T-mount** — it also ships in a 2 mm variant, so check the listing:
  <https://www.racedayquads.com/products/hq-prop-t3x2x3-1-5mm-shaft-tri-blade-3-prop-4-pack-choose-color>
- **Battery — 4S 650 mAh** (C rating / brand not recorded). Frame's range is 3–4S 550–850 mAh.
- **VTX — HDZero Freestyle V2 VTX Kit**, which **includes the Nano90 camera** (19×19 mount), an
  RHCP antenna, a 120 mm MIPI cable, power and SA cables:
  <https://www.getfpv.com/hdzero-freestyle-v2-vtx-kit.html>
- **Antenna — RushFPV Cherry**, 5.8 GHz RHCP, 1.2 dBi, 98 % efficiency, 7.5 g. Used on **both** this
  and the Y6. ⚠ Sold in **U.FL / MMCX / SMA** — the HDZero VTXs are U.FL, so order U.FL.
  A **Cherry 2** exists (1.8 dBi avg, VSWR ≤1.3, 99 %, ~30 % smaller) as a cheap upgrade.
- ~~**Analog — RushFPV Tank Ultimate Mini + Caddx Ratel 2**~~ — **removed** in the HDZero conversion;
  now in [`shared-gear.md`](shared-gear.md) as unassigned spares. The Tank Ultimate Mini is
  **7–36 V, 20×20, 800 mW, MMCX** (listing branded "SoloGood"; PCB says RushFPV):
  <https://www.amazon.com/SoloGood-Transmitter-20x20mm-External-Audio-Connector/dp/B094C7M6PD>

### FCs for the Carnage 4.5 + Aether 4 (ordered 2026-09-01)

- **HDZero Gamma 45A HD-Ready AIO**, **$79.99**, **×2** — one per build:
  <https://www.getfpv.com/hdzero-gamma-aio-g473-fc-45a-am32-esc-elrs-rx.html>
  - STM32G473 (170 MHz) + ICM42688, **45 A cont / 60 A burst AM32**, **3–6S**, 33×33 mm /
    **25.5×25.5 M2**, **8.4 g**.
  - ✅ **Built-in 2.4 GHz ExpressLRS receiver** — no separate RX needed on either build.
  - ✅ **Protected 8 V / 3 A BEC for the digital VTX** (plus 5 V / 3 A) — the safe answer to the
    pack-voltage pad problem above, at any cell count.
  - ⚠ **"HD-ready", not VTX-integrated** — an HDZero VTX is still a purchase.
  - ⚠ Bought as a "40 A HDZero AIO"; the Gamma is the only 40-A-class AIO HDZero sells (the others
    are the 1S/5 A **AIO5** and the 2–3S/15 A **AIO15**). **Confirm the model on arrival.**

## FPV — DJI O4 (Pavo20, Pavo Femto)

- **DJI O4 Air Unit** (standard, 4K 60fps, super-wide FOV), AliExpress:
  <https://www.aliexpress.us/item/3256806298932479.html>
- **DJI Goggles N3** (1080p, O4 FHD), AliExpress: <https://www.aliexpress.us/item/3256807909741977.html>

## FPV — HDZero (CineLog 3.5)

Bought 2026-08 for the [CL35](../cinelog35-tof/README.md); the ground side and spare cables serve any
future HDZero build.

- **HDZero Whoop V2 VTX** (bundle) — ships with a **14 mm** camera and a **40 mm** MIPI cable
- **HDZero Micro V3 camera** (19 mm) — bought separately; the CL35 takes 19 mm, the bundled 14 mm
  does not fit
- **MIPI cables** — 2× **80 mm** (expected fit) and 1× **120 mm**; with the bundled 40 mm this is a
  full length array for the next build
- **HDZero ProBox+** — ground side; the ecosystem is complete

## FPV — HDZero (fleet-wide reference)

The ecosystem outgrew the CL35 — it now covers four craft. **Two things are not uniform across the
line and both have bitten:**

⛔ **Input voltage.** Check the VTX's range against the FC's video pad **every build** — see the
[fleet-wide note](../README.md#-hdzero-vtx-power-is-not-uniform--read-the-fc-pad-every-time).

| VTX | Input | Draw | Mount | On |
|---|---|---|---|---|
| **Whoop V2** | **3–12.6 V (1S–3S)**, no reverse-polarity protection | — | 25.5×25.5 | CL35 · Reliant Y6 (one destroyed) |
| **Freestyle V2** | **7–25 V (2S–6S)**, 25–1000 mW, 22.3 g | **6–15 W** | **20×20** | 3" freestyle |

⚠ **Current matters too.** The Freestyle V2's 15 W peak is **1.67 A on a 9 V rail** — over the
SpeedyBee F405 AIO V2's 1.5 A BEC. Check the FC's BEC rating, not just its pad voltage.

⚠ **Mount pattern.** The Freestyle V2 is **20×20**; everything else here is **25.5×25.5**. VTXs do
not swap freely between craft.

### Cameras

| Camera | Sensor | Modes | Size | Weight | On |
|---|---|---|---|---|---|
| **Nano90** | 1/3" | 540p90 / 720p60 (4:3) | 14 mm | 5.2 g | 3" freestyle — **being replaced, image judged poor** |
| **Nano V3** | **1/2"** | 720p60 (4:3) | 14 mm | **2.2 g** | Reliant Y6 · the leading Nano90 replacement |
| **Micro V3** | **1/2"** | 1080p30 native **16:9** | 19 mm | 7.5 g | CL35 · best image, needs the bay |
| _(spare)_ 14 mm bundle cam | — | — | 14 mm | — | earmarked for the Carnage 4.5 |

- Docs — Whoop V2: <https://docs.hd-zero.com/whoop-v2> · Nano V3:
  <https://docs.hd-zero.com/camera-nano-v3> · Micro V3: <https://docs.hd-zero.com/camera-micro-v3>

## Custom build — CineLog 3.5 ToF (indoor autonomy)

Parts for the [`cinelog35-tof/`](../cinelog35-tof/README.md) build (mostly AliExpress).

- **Frame** — GEPRC GEP-CL35 V3, 3.5" ducted O4 CineLog: <https://www.aliexpress.us/item/3256810368292627.html>
- **FC** — TAKER F722 45A 32-bit AIO: <https://www.aliexpress.us/item/3256809522031754.html>
- **Motors** — GEPRC SPEEDX2 2105.5 2450KV (4-pack): <https://www.aliexpress.us/item/3256812397590001.html>
- **Props** — HQProp Duct-T90MMX3 (3.5" ducted, 6 pairs): <https://www.aliexpress.us/item/3256809907108000.html>
- **RX** — RadioMaster RP3 ELRS: <https://www.aliexpress.us/item/3256805325327886.html>
- **GPS/compass** — HGLRC M100-5883 (M10 + QMC5883): <https://www.aliexpress.us/item/3256809025534880.html>
- **Optical flow + ToF** — MicoAir MTF-01: <https://www.aliexpress.us/item/3256809389865494.html>
- **ToF ring** — TOF400C (VL53L1X), 11×: <https://www.aliexpress.us/item/3256806637257364.html>
- **FC — MicoAir 743-AIO.** ⚠ The TAKER F722 above was **superseded**; the airframe flies a
  MicoAir 743-AIO. Purchase link not recorded.
- **I²C muxes — 2× PCA9548A**, fitted. (Two, not one: 8 channels each, 11 sensors.)
- **Companion — Waveshare ESP32-S3-Zero**, on hand. ⚠ **The Raspberry Pi is dropped** — the ring is a
  few hundred bytes/sec of scalars and never needed Linux, a dedicated BEC, or ~1 A of draw.
- **Video — HDZero**, see the HDZero section above.
- _Still to buy:_ 4S pack (~850–1100 mAh) — the last open purchase on this build — and a self-powered
  buzzer for the BZ pad.

## Custom build — DH600 (long-endurance cinematic platform)

Parts for the [`dh600/`](../dh600/README.md) build (all AliExpress). **Largely bought and assembled
as of 2026-08-17** — motors, ESCs, PM07, GPS and the Dronetag BS are mounted in the frame. Prices
quoted 2026-07-26 and will have drifted.

- **Frame** — DH600 CF folding quad kit, 600 mm, 398 g — **ordered**: <https://www.aliexpress.us/item/2251832645328393.html>
- **Motors** — SunnySky X4110S 400 KV, ×4 ($53.74): <https://www.aliexpress.us/item/3256811369672356.html>
- **ESC** — Hobbywing XRotor 40 A 3–6S, ×4 ($19.15): <https://www.aliexpress.us/item/3256810401625172.html>
- **Props** — CF 1555 (15×5.5), ×4 ($19.99): <https://www.aliexpress.com/item/2251832769901052.html>
- ~~**PDB** — Holybro 60 A ($27.87)~~ — dropped, XT60 input only 30 A continuous; keep as X500 spare:
  <https://www.aliexpress.com/item/3256805647596698.html>
- **No separate PDB.** The power module distributes to the ESCs off its B+ pads / PWM header.
  Re-pigtail its input to **8 AWG + AS150** (XT120 minimum — XT90 is only 45 A/90 A on Holybro's
  table). Module comparison: <https://docs.holybro.com/power-module-and-pdb/power-module-comparison>
- ~~**Power module upgrade — PM08-CAN**~~ — **rejected.** ~$100, and it forces a separate ~$50 300 A
  PDB back in (PM08 is an inline sensor, no distribution). The bundled PM07 runs at 17 % of continuous
  at hover and 41 % at the top of the motor's published thrust table; the 160 A figure it would have
  covered is a fault bound, not a flight bound.
- _More margin if wanted:_ **Holybro PM08-CAN**, 200 A cont / 400 A burst, DroneCAN (price unchecked).
- **FC** — **Pixhawk 6C (full size) + M10 GPS + PM07 bundle, ~$300** — confirm PM07 with the seller.
  Chosen over the 6C Mini + PM02/PM06 kit ($310.57,
  <https://www.aliexpress.us/item/3256812360792507.html>): cheaper, PM07 is 90 A/140 A with 2 BECs,
  and the full board adds a 5th UART + dedicated S.Bus out.
- **FC bushings** — silicone vibration isolators ($2.66): <https://www.aliexpress.us/item/3256811997806516.html>
- **Video + datalink** — SIYI HM30, air **and** ground unit ($314.56), **on hand**:
  <https://www.aliexpress.us/item/3256810236165659.html>
- **Camera** — SIYI A8 mini 3-axis gimbal ($274.36), **in transit**: <https://www.aliexpress.us/item/3256806472533602.html>
- **SIYI AI Tracking Module 2 (10T)** — 10 TOPS onboard object tracking, **in transit**. ⚠ Not in the
  original weight/power/topology budget — check before mounting.
- **SIYI Ethernet → HDMI converter** — lets the HM30 ground unit drive goggles instead of the laptop
  station. **On hand.**
- **Dronetag BS** Remote ID module — **mounted**; same module as the CL35.
- **FC soft mount** — **on order**, and currently the critical-path item: the Pixhawk and the HM30 air
  unit are both waiting on it.
- **RX** — RadioMaster RP3 ELRS ($18.48), **on the aircraft**, CRSF into GPS2, run at 50 Hz:
  <https://www.aliexpress.us/item/3256811780581682.html>
- _Control-link upgrade (not planned):_ Gemini is a TX+RX scheme, not a receiver swap — needs a
  **Nomad** dual-1W Xrossband module **and** a **DBR4** receiver. Its 900 MHz half would collide with
  the 915 MHz SiK radio. See project README.
- _Still to buy:_ **Tattu 6S 12000 mAh 15C** with AS150 fitted (**$270**, 1619 g — 16 Ah buys only
  ~3 min for 540 g and exceeds the frame envelope); **2× 6S 5–6 Ah** shakedown packs (~$60–90 ea) for
  maiden flight and tuning; a **12 V BEC** for the HM30 air unit (needs 11–16.8 V); plus 8 AWG wire and
  an AS150 pair (~$15) for the power-module re-pigtail.
- Original list ≈ **$1041**; ~**$1300** all-in after the FC swap, PDB deletion, pack and BEC.
- _Also consider:_ a DC supply for the HOTA D6 Pro — 200 W on AC means ~1.5 h for a 266 Wh pack.

## Custom build — Jet Catamaran (surface, twin water-jet)

Propulsion for the [`jet-catamaran/`](../jet-catamaran/README.md) build (TFL 30 mm water-jet ×2).
Buy 2× of the propulsion train; pick one tier (2-blade/90 A **or** 4-blade/120 A) — see the project
README. Nothing purchased yet.

- **Jet drive** — TFL 30 mm water-jet, plastic pump w/ reversing (Combo A–D):
  <https://www.aliexpress.us/item/3256802068439412.html>
- **Jet drive (à-la-carte)** — TFL 30 mm, impellers / 90A / 120A ESC / servo / nozzle options
  (model B54253): <https://www.aliexpress.us/item/2251832825443093.html>
- _Standard tier:_ 2-blade impeller + SSS 2860/2960 KV2200 + Hobbywing SeaKing **90A** water-cooled ESC, 4S.
- _Upgrade tier:_ 4-blade impeller + SSS 3660 KV2726 + **120A** water-cooled ESC, 4S.
- _Also needed:_ 3 kg steering servo ×(1–2), 4S pack(s), ELRS surface RX, filament + fiberglass/epoxy,
  M2.5 heat-set inserts, silicone cooling line + barbs, cable glands.
- Reference (specs/dimensions) — flight-model.com B54253:
  <https://flight-model.com/products/tfl-rc-boat-b54253-water-jet-thruster-jet-pump-water-jet-drive-boat-remote-control-model-refit-nozzle>

## Batteries

- **X500** — OVONIC 4S 14.8V 4500mAh 50C, 2-pack, Amazon `B07CV9M1BN`:
  <https://www.amazon.com/dp/B07CV9M1BN>
- **Pavo20** — BetaFPV LAVA II 3S 680mAh 11.4V 95C LiHV (XT30), 2-pack, Amazon `B0GLNXB7YR`:
  <https://www.amazon.com/dp/B0GLNXB7YR>
- **Pavo Femto** — OVONIC 2S 7.4V 450mAh 80C LiPo (XT30, long size), 4×, Amazon `B0D3F6BRB9`:
  <https://www.amazon.com/dp/B0D3F6BRB9>

## Spares

- **BetaFPV Pavo Femto frame** — 75mm micro whoop frame, HD VTX bracket for O4 Air Unit, PA12,
  spare for the Femto, Amazon `B0DXT1PLCZ`: <https://www.amazon.com/dp/B0DXT1PLCZ>
- **BetaFPV Pavo20 Pro II frame** — spare frame for the Pavo20, Amazon `B0G6KW59K4`:
  <https://www.amazon.com/dp/B0G6KW59K4>

## X500 payload — VLP-16 lidar

Decided 2026-08-17. Sensor is **already owned** (shared with
[`tools/point-cloud-visualizer`](../../tools/point-cloud-visualizer/docs/vlp16-getting-started.md)),
so this is a mount-and-support-hardware purchase, not a sensor purchase.

- ~~**RoboSense Airy**~~ — **dropped.** Price never came down and import regulation makes it awkward.
- **Velodyne VLP-16 Lite + interface box** — on hand.
- _Still to buy:_ a **12 V BEC** for the interface box (Ethernet does not power the sensor), soft-mount
  hardware, and a **companion computer with an Ethernet NIC** — now required rather than optional,
  since the Pixhawk 6C has no Ethernet.
- _To make:_ a body-slung mount clearing the 215 mm landing gear, with the legs either outside the
  sensor's ±15° vertical FOV or masked in software.

## Planned / wishlist

- **Pavo35 or similar** — 3.5" BetaFPV cinewhoop (candidate; not yet ordered). Suitable
  alternative: **AstroRC 35V2**.
- **BM Aether 4** — free 3D-printed **unibody 4/4.5" frame**, ~40 g, printed in one piece:
  <https://makerworld.com/en/models/541413-bm-aether-4-the-4-inch-unibody-fpv-drone-frame>
  **Printing only, no build planned** — one filament roll makes ~20 copies. ⚠ If a build ever
  happens it needs a **BetaFPV Pavo 20 VTX chassis**, which is *not* in the print file (check whether
  the spare Pavo20 Pro II frame's chassis interchanges before buying). See
  [`aether-4/`](../aether-4/README.md).
- **Aeroptera Lace II "Aero"** — free 3D-printable **800 mm folding quad**, >5 kg takeoff, >1.5 kg
  payload. Frame files and a 48-page manual are free: <https://aeroptera.xyz/aero/> ·
  [Drive](https://drive.google.com/drive/folders/19wE2HiMpM_tG5de_xOI7Jf4PQMr0pt7q). Under
  evaluation. Notable: **Pixhawk 6C + Holybro PM07 is the only recommended stack** and the reference
  build uses **Hobbywing X-Rotor 40 A ESCs** — both already in the DH600, so that knowledge carries
  over. Materials are **Polymaker Fiberon** (PETG-rCF08 mandatory for the motor clamps — *not*
  nylon, *not* PLA). Also needs 4× **16×13×220 mm** CF tubes and a **pair** of 4S 4500 mAh XT60
  packs per flight. See [`aeroptera/`](../aeroptera/README.md).
- ~~**SAR drone** (SIYI ZT6 thermal gimbal)~~ — **shelved 2026-08-17.** Thermal sensors at a useful
  capability are export/import controlled, and the mission does not work without one.
