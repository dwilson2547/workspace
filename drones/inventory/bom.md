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

## FPV (Pavo20)

- **DJI O4 Air Unit** (standard, 4K 60fps, super-wide FOV), AliExpress:
  <https://www.aliexpress.us/item/3256806298932479.html>
- **DJI Goggles N3** (1080p, O4 FHD), AliExpress: <https://www.aliexpress.us/item/3256807909741977.html>

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
- _Still to buy:_ 4S pack (~850–1100 mAh), Raspberry Pi / SBC companion, I2C mux (TCA9548A) or XSHUT wiring.

## Custom build — DH600 (long-endurance cinematic platform)

Parts for the [`dh600/`](../dh600/README.md) build (all AliExpress). **Frame ordered 2026-07-26**;
nothing else purchased. Prices quoted 2026-07-26.

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
- **Video + datalink** — SIYI HM30 ($314.56): <https://www.aliexpress.us/item/3256810236165659.html>
- **Camera** — SIYI A8 mini 3-axis gimbal ($274.36): <https://www.aliexpress.us/item/3256806472533602.html>
- **RX** — RadioMaster RP3 ELRS ($18.48), ground-station side, may swap to Gemini:
  <https://www.aliexpress.us/item/3256811780581682.html>
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

## Planned / wishlist

- **Pavo35 or similar** — 3.5" BetaFPV cinewhoop (candidate; not yet ordered). Suitable
  alternative: **AstroRC 35V2**.
