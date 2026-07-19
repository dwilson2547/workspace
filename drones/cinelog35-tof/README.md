---
tier: reference
domain: drones
---

# CineLog 3.5 — ToF indoor autonomy build

**Planned custom build.** A 3.5" ducted quad (GEPRC CineLog 35 airframe) fitted with a Time-of-Flight
sensor suite and a Raspberry Pi–class companion computer, aimed at **assisted or fully autonomous
indoor flight** — position hold and obstacle avoidance without GPS. This is the first from-parts
build in the domain (the X500/Pavo craft are kits/BNFs).

Status: **parts being ordered — nothing assembled.** Specs below are the intended build; battery and
companion computer are not yet chosen.

## Concept

Indoor, GPS-denied autonomy on a small ducted platform:

- **Optical flow + down-facing ToF** (MicoAir MTF-01) gives the flight controller a velocity/altitude
  reference for stable position hold without GPS.
- **A ring of 11 ToF rangefinders** (VL53L1X) gives the companion computer a coarse obstacle field
  around the craft (surround + up/down), which it turns into avoidance / autonomous navigation and
  feeds back to the FC as setpoints.
- The ducts make close-quarters flight (bumping walls, prop guards) survivable.

## Intended spec

| Item | Part | Notes |
|------|------|-------|
| Frame | GEPRC GEP-CL35 V3, 3.5" ducted (CineLog 35, O4-ready) | ducted cinewhoop airframe |
| Flight controller | **TAKER F722 45A 32-bit AIO** | F7 chosen for UART/compute headroom (companion computer + sensors) |
| Motors | GEPRC SPEEDX2 2105.5 2450 KV (×4) | 4S-class |
| Props | HQProp Duct-T90MMX3 (90 mm / 3.5" ducted tri-blade) | 6 pairs on hand |
| RC link | **RadioMaster RP3 ELRS** (CRSF) | bind phrase `dwdrones` (same as other craft) |
| GPS / compass | HGLRC M100-5883 (M10 GPS + QMC5883 compass) | optional outdoor; indoor nav is ToF/flow-based |
| Optical flow + ToF | **MicoAir MTF-01** | down-facing flow + single-point lidar for position/altitude hold |
| Obstacle ToF array | **11× TOF400C (VL53L1X)**, up to ~4 m | surround obstacle sensing → companion computer |
| Companion computer | Raspberry Pi (model TBD) or similar SBC | reads ToF array, runs avoidance/autonomy, drives FC |
| Battery | 4S ~850–1100 mAh (XT30/XT60) | **not yet purchased** |
| Video / FPV | DJI O4-ready frame | O4 unit TBD |
| Autopilot stack | Betaflight (MSP override) **or** INAV — TBD | INAV has native optical-flow/rangefinder nav; decision pending |

Parts on hand vs. still-to-buy: [`inventory.md`](inventory.md).

## Sensor / autonomy architecture (planned)

```
        [11× VL53L1X ToF ring]           [MicoAir MTF-01]
          (I2C, obstacle field)        (flow + down ToF, MSP/UART)
                  |                              |
                  v                              v
        [Raspberry Pi companion] ---UART---> [TAKER F722 FC] ---> motors/ESC
         obstacle avoidance /   (MSP / MAVLink   Betaflight/INAV
         autonomous setpoints)   setpoints)      + ELRS (RP3)
```

- **MTF-01 → FC:** the flow/lidar module talks to the FC directly (MSP), giving loiter/position-hold
  without the Pi in the loop. This is the "assisted" layer that works even if the companion computer
  is off.
- **ToF ring → Pi:** the 11 VL53L1X feed the Pi, which builds the obstacle field and issues
  avoidance / navigation setpoints to the FC over UART (MSP override or MAVLink). This is the
  "autonomous" layer.

### ⚠ Design notes to resolve before wiring

- **VL53L1X I2C address collision.** Every VL53L1X powers up at the **same I2C address (0x29)**. Eleven
  on one bus cannot coexist as-is. Two standard fixes: (a) **XSHUT sequencing** — hold all in reset,
  bring them up one at a time and reassign each a unique address; or (b) an **I2C multiplexer**
  (TCA9548A). Note a single TCA9548A only has **8 channels**, so 11 sensors need **two muxes** (or
  mux + XSHUT). Budget GPIO/wiring for whichever approach. _Not yet decided._
- **Sensor placement/coverage.** 11 sensors ≈ front/back/left/right + 4 diagonals + up + down (with
  one spare / redundancy). Confirm the mounting plan and per-sensor FoV overlap.
- **FC ↔ Pi protocol.** Decide MSP (Betaflight) vs. MAVLink (INAV/Ardu) — drives the whole autopilot
  stack choice above.
- **Power for the Pi** off the 4S pack (regulator/BEC sizing) and total AUW with the companion
  computer + sensor ring.

## Status

- [ ] All parts acquired (battery + companion computer still to buy)
- [ ] Autopilot stack chosen (Betaflight+MSP vs INAV)
- [ ] Airframe assembled + FC flashed
- [ ] ELRS bound (RP3, phrase `dwdrones`)
- [ ] MTF-01 position hold working (assisted layer)
- [ ] VL53L1X ring addressing solved + wired
- [ ] Companion computer obstacle avoidance (autonomous layer)
- [ ] First indoor hover

## Build log

- **2026-07-16** — Build planned; core parts (frame, FC, motors, props, RP3, M10 GPS, MTF-01, 11×
  VL53L1X) being ordered. Battery and companion computer not yet selected. Open decisions captured
  above.

## Links

- Frame — GEPRC GEP-CL35 V3 (AliExpress): <https://www.aliexpress.us/item/3256810368292627.html>
- FC — TAKER F722 45A 32-bit AIO (AliExpress): <https://www.aliexpress.us/item/3256809522031754.html>
- Motors — GEPRC SPEEDX2 2105.5 2450KV (AliExpress): <https://www.aliexpress.us/item/3256812397590001.html>
- Props — HQProp Duct-T90MMX3 (AliExpress): <https://www.aliexpress.us/item/3256809907108000.html>
- RX — RadioMaster RP3 ELRS (AliExpress): <https://www.aliexpress.us/item/3256805325327886.html>
- GPS — HGLRC M100-5883 (AliExpress): <https://www.aliexpress.us/item/3256809025534880.html>
- MTF-01 optical flow + ToF (AliExpress): <https://www.aliexpress.us/item/3256809389865494.html>
- TOF400C VL53L1X (AliExpress): <https://www.aliexpress.us/item/3256806637257364.html>
