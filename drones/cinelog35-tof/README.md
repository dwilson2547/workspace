---
tier: reference
domain: drones
---

# CineLog 3.5 — ToF indoor autonomy build

**Custom build.** A 3.5" ducted quad (GEPRC CineLog 35 airframe) fitted with a Time-of-Flight
sensor suite and a Raspberry Pi–class companion computer, aimed at **assisted or fully autonomous
indoor flight** — position hold and obstacle avoidance without GPS. This is the first from-parts
build in the domain (the X500/Pavo craft are kits/BNFs).

Status: **airframe flying on ArduPilot.** First hovers flown outdoors 2026-08-02 — orientation,
motor mapping, RC direction, and gyro filtering all resolved (see
[FC configuration](#flight-controller-configuration)). The ToF ring and companion computer are
**not yet fitted** — the autonomy layer is still ahead.

## Concept

Indoor, GPS-denied autonomy on a small ducted platform:

- **Optical flow + down-facing ToF** (MicoAir MTF-01) gives the flight controller a velocity/altitude
  reference for stable position hold without GPS.
- **A ring of 11 ToF rangefinders** (VL53L1X) gives the companion computer a coarse obstacle field
  around the craft (surround + up/down), which it turns into avoidance / autonomous navigation and
  feeds back to the FC as setpoints.
- The ducts make close-quarters flight (bumping walls, prop guards) survivable.

## Spec

| Item | Part | Notes |
|------|------|-------|
| Frame | GEPRC GEP-CL35 V3, 3.5" ducted (CineLog 35, O4-ready) | ducted cinewhoop airframe |
| Flight controller | **MicoAir H743 v2** | H7. Replaced the originally-planned TAKER F722 AIO — more UART/compute headroom for the companion computer |
| ESC | **AM32 4-in-1** (firmware 2.19) | DShot600; separate from the FC (not an AIO) |
| Motors | GEPRC SPEEDX2 2105.5 2450 KV (×4) | 4S-class |
| Props | HQProp Duct-T90MMX3 (90 mm / 3.5" ducted tri-blade) | 6 pairs on hand |
| RC link | **RadioMaster RP3 ELRS** (CRSF) | bind phrase `dwdrones` (same as other craft) |
| GPS / compass | HGLRC M100-5883 (M10 GPS + QMC5883 compass) | optional outdoor; indoor nav is ToF/flow-based |
| Optical flow + ToF | **MicoAir MTF-01** | down-facing flow + single-point lidar for position/altitude hold |
| Obstacle ToF array | **11× TOF400C (VL53L1X)**, up to ~4 m | surround obstacle sensing → companion computer |
| Companion computer | Raspberry Pi (model TBD) or similar SBC | reads ToF array, runs avoidance/autonomy, drives FC |
| Battery | 4S ~850–1100 mAh (XT30/XT60) | in use; 15.2 V start, 14.2 V min under a 52 A peak |
| Video / FPV | DJI O4-ready frame | O4 unit TBD |
| Autopilot stack | **ArduPilot 4.7.0 (ArduCopter)** | chosen over Betaflight/INAV — native MAVLink companion interface, EKF3, AUTOTUNE |

Parts on hand vs. still-to-buy: [`inventory.md`](inventory.md).

## Flight controller configuration

The FC had to be mounted **square** on a frame whose mounting pattern expects **diamond**, and
**inverted**. Everything below follows from that. Settled 2026-08-02 and flight-verified.

| Param | Value | Why |
|-------|-------|-----|
| `AHRS_ORIENTATION` | `15` (`ROLL_180_YAW_315`) | board mounted inverted and 45° off the airframe nose |
| `COMPASS_EXTERNAL` | `1` | M100-5883 is on a mast — `AHRS_ORIENTATION` does **not** apply to it |
| `COMPASS_ORIENT` | `2` (`YAW_90`) | auto-derived by `COMPASS_AUTO_ROT,2` once the board frame was right |
| `SERVO1_FUNCTION` | `34` (Motor2) | motor position remap — see below |
| `SERVO2_FUNCTION` | `33` (Motor1) | " |
| `MOT_PWM_TYPE` | `6` | DShot600 |
| `RC2_REVERSED` | `1` | TX16S pitch channel direction — same flag the X500 needs |
| `INS_HNTCH_ENABLE` | `1` | harmonic notch; see [gyro filtering](#gyro-filtering) |
| `INS_HNTCH_MODE` | `1` | throttle-referenced |
| `INS_HNTCH_FREQ` | `287` | measured motor fundamental at hover |
| `INS_HNTCH_BW` | `143` | ≈ FREQ/2 |
| `INS_HNTCH_REF` | `0.2` | matches `MOT_THST_HOVER` |
| `INS_HNTCH_HMNCS` | `3` | fundamental + 2nd harmonic |
| `INS_LOG_BAT_MASK` | `1` | raw IMU batch sampling — **required** for FFT in log review |

### Orientation

`AHRS_ORIENTATION` must be set **before** accelerometer calibration — ArduPilot applies it to raw
IMU data before computing offsets, so a cal done under the wrong orientation is baked into the wrong
frame and has to be redone.

Two traps cost real time here:

- **The Mission Planner HUD is an attitude indicator** — the horizon rotates *opposite* to the
  airframe. Lifting the left side tilts the horizon line the other way. That is correct behavior and
  reads as an inversion. Judge orientation from the numeric `roll`/`pitch` in **Data → Status**
  (right side down → `roll` positive, nose up → `pitch` positive), never from the graphic.
- **`COMPASS_AUTO_ROT` solves the compass against the board frame.** With a wrong
  `AHRS_ORIENTATION` it converges on a weird compensating value (`13` here). Once the board was
  right it landed on a clean `2`. A simple auto-derived `COMPASS_ORIENT` is evidence the frame under
  it is correct; a strange one is evidence it isn't.

### Motor mapping and direction

Rotating the FC 45° rotates its output pads with it. `AHRS_ORIENTATION` fixes the *sensors* only —
motor outputs are physical and must be remapped separately. Do **not** compensate a second time by
changing `FRAME_TYPE`; the airframe is still Quad X (`FRAME_CLASS,1` / `FRAME_TYPE,1`).

Physical pad → motor position, measured with Motor Test:

| Output | Position |
|--------|----------|
| 1 | rear-left |
| 2 | front-right |
| 3 | front-left |
| 4 | rear-right |

Mission Planner's Motor Test letters run **clockwise from front-right** (A=front-right,
B=rear-right, C=rear-left, D=front-left) and map to motor numbers A=1, B=4, C=2, D=3.

**Spin direction lives in the ESC, not the param file.** All four motors were soldered with
identical wire order, so all four spun the same way — no yaw authority, and it would not lift.
Neither `SERVO_BLH_RVMASK` nor `SERVOn_REVERSED` fixed it. It was set in AM32 firmware over
passthrough (`SERVO_BLH_AUTO,1`), reversing **ESC 3 and ESC 4**. Both ArduPilot-side reversal
params are back to `0` so nothing fights the ESC setting.

> **Identifying the ESC firmware.** BLHeliSuite32 said *"bootloader not valid for BLHeli32"* while
> legacy BLHeliSuite in SiLabs mode said *"found BLHeli_32 (expected SiLabs)"*. Each tool insisting
> it's the other kind means **an ARM ESC that isn't BLHeli_32** — i.e. AM32. Version numbering
> confirms it: BLHeli_S is 16.x, BLHeli_32 is 32.x, AM32 is 1.x/2.x. Use the **AM32 web
> configurator**; esc-configurator.com lags AM32 releases and rejected 2.19 as unsupported.

### Gyro filtering

Log FFT at hover (requires `INS_LOG_BAT_MASK,1`):

| Source | Freq | Fixed by notch? |
|--------|------|-----------------|
| Motor fundamental (gyro Y) | ~287–308 Hz | **yes** |
| Frame/duct resonance (gyro X) | ~30 Hz | no |
| Low-frequency content (gyro Z) | 16–26 Hz | no |

Enabling the notch cut gyro noise 61/76/57% (X/Y/Z) and roll attitude error 92% (5.42° → 0.43°
mean). Mechanical vibration was already low (VIBE mean 0.7–1.0 m/s/s) — the problem was electrical
feedback, not balance, so **props and ducts were never the issue** for control quality.

**The notch does not reduce audible noise.** It filters the gyro signal so motor noise isn't
amplified back into motor commands. Acoustic output is aerodynamic and essentially unchanged by it.
The audible character of this airframe is still uncharacterised — the ~30 Hz resonance and the
blade-passing tone (3 blades × ~300 Hz motor fundamental ≈ 900 Hz) are the candidates. _Open._

### Compass

Recalibrated outdoors 2026-08-02. Soft-iron fit tightened by roughly an order of magnitude
(`COMPASS_ODI_X` 0.0189 → 0.0019, `COMPASS_DIA_Y` 0.974 → 0.999) and in-flight field magnitude is
stable at **502 mGauss, sd 11** over 1182 samples — a healthy compass.

Two things remain:

- **`COMPASS_OFS_Y,389`** is hard iron from the aircraft itself — motor magnets near the M100. No
  calibration site removes this; only physical separation will.
- **`COMPASS_SCALE,0.81`** is still well below the World Magnetic Model expectation. Calibrate with
  GPS lock, on grass rather than pavement, held at head height — rebar in slabs and driveways is the
  dominant local disturber and it falls off fast with vertical distance.

ArduPilot reports only the **first** failing prearm check, so a battery failure can mask a mag
failure. Confirm the mag check is genuinely clear on a charged pack before calling it closed.

### Battery and failsafe

| Param | Value | Why |
|-------|-------|-----|
| `BATT_CAPACITY` | `1300` | actual pack. Was left at a `3300` default, which made every mAh-based warning meaningless |
| `BATT_FS_CRT_ACT` | `1` (Land) | **the armed stage** |
| `BATT_CRT_VOLT` | `14.0` | 3.5 V/cell — where Land actually fires |
| `BATT_FS_LOW_ACT` | `0` (None) | low stage deliberately disarmed — single-stage protection |
| `BATT_LOW_VOLT` | `14.4` | 3.6 V/cell; set, but inert while `FS_LOW_ACT` is `0` |
| `BATT_FS_VOLTSRC` | `1` | **sag-compensated** voltage |
| `BATT_ARM_VOLT` | `14.7` | resting; blocks arming a part-used pack |

**Single-stage by design.** ArduPilot's two battery stages exist to escalate between *different*
actions — LOW → RTL while there's still energy to fly home, CRT → Land when there isn't. That split
only means something on a craft that flies away from the pilot. This one never leaves arm's reach,
so RTL is meaningless and there's nothing to escalate to. Only the critical stage is armed.

`BATT_FS_VOLTSRC,1` is what makes that safe: this airframe pulls 45–52 A peaks against a 1300 mAh
pack, and on **raw** voltage those peaks dip below the threshold during normal flight and would
trigger a surprise auto-land. Sag compensation judges the pack on state of charge instead.

> ⚠ **The failsafe is configured but unverified.** It has never fired — no confirmed low- or
> critical-voltage event since it was set. The threshold, the timer, and the sag compensation are
> all untested against real behaviour. Treat pack limits as a pilot responsibility until the
> failsafe has been observed triggering and recovering as intended.

## Sensor / autonomy architecture (planned)

```
        [11× VL53L1X ToF ring]           [MicoAir MTF-01]
          (I2C, obstacle field)        (flow + down ToF, UART)
                  |                              |
                  v                              v
        [Raspberry Pi companion] ---UART---> [MicoAir H743 FC] ---> AM32 4-in-1 ESC
         obstacle avoidance /     (MAVLink     ArduPilot 4.7.0        (DShot600)
         autonomous setpoints)     setpoints)  + ELRS (RP3, CRSF)
```

- **MTF-01 → FC:** the flow/lidar module talks to the FC directly, giving loiter/position-hold
  without the Pi in the loop. This is the "assisted" layer that works even if the companion computer
  is off.
- **ToF ring → Pi:** the 11 VL53L1X feed the Pi, which builds the obstacle field and issues
  avoidance / navigation setpoints to the FC over UART via **MAVLink**. This is the "autonomous"
  layer.

### ⚠ Design notes to resolve before wiring

- **VL53L1X I2C address collision.** Every VL53L1X powers up at the **same I2C address (0x29)**.
  Eleven on one bus cannot coexist as-is. Two standard fixes: (a) **XSHUT sequencing** — hold all in
  reset, bring them up one at a time and reassign each a unique address; or (b) an **I2C
  multiplexer** (TCA9548A). Note a single TCA9548A only has **8 channels**, so 11 sensors need **two
  muxes** (or mux + XSHUT). Budget GPIO/wiring for whichever approach. _Not yet decided._
- **Sensor placement/coverage.** 11 sensors ≈ front/back/left/right + 4 diagonals + up + down (with
  one spare / redundancy). Confirm the mounting plan and per-sensor FoV overlap.
- ~~**FC ↔ Pi protocol.**~~ **Resolved** — MAVLink, following the move to ArduPilot.
- **Power for the Pi** off the 4S pack (regulator/BEC sizing) and total AUW with the companion
  computer + sensor ring.
- ~~**Compass interference.**~~ **Improved** — recalibrated 2026-08-02, field now stable. Residual
  hard-iron offset is a mounting-distance problem, not a calibration one. See
  [Compass](#compass).

## Status

- [x] Airframe assembled + FC flashed (ArduPilot 4.7.0)
- [x] Autopilot stack chosen (ArduPilot, MAVLink to companion)
- [x] ELRS bound (RP3, phrase `dwdrones`, CRSF)
- [x] Board orientation + accel/compass calibration correct
- [x] Motor order and spin directions correct
- [x] Harmonic notch configured against measured hover frequency
- [x] First hover (outdoors, Stabilize)
- [x] Compass recalibrated — field stable at 502 mGauss, sd 11
- [x] Battery capacity + low-voltage failsafe configured (Land, sag-compensated)
- [ ] AUTOTUNE — **next step**; filtering is in place, tracking is clean
- [ ] Confirm mag prearm is clear on a charged pack (battery failure may have masked it)
- [ ] Audible noise characterised (mic + acoustic FFT)
- [ ] **Battery failsafes verified in flight** — configured, but neither low nor critical has ever
      triggered, so thresholds and timer are untested
- [ ] All parts acquired (companion computer still to buy)
- [ ] MTF-01 position hold working (assisted layer)
- [ ] VL53L1X ring addressing solved + wired
- [ ] Companion computer obstacle avoidance (autonomous layer)
- [ ] First indoor hover

## Build log

- **2026-07-16** — Build planned; core parts (frame, FC, motors, props, RP3, M10 GPS, MTF-01, 11×
  VL53L1X) being ordered. Battery and companion computer not yet selected. Open decisions captured
  above.
- **2026-08-02** — **First flights.** Flight controller is a **MicoAir H743 v2** on ArduPilot 4.7.0
  with a separate **AM32 4-in-1 ESC** — the TAKER F722 AIO in the original plan was dropped weeks
  earlier and these docs had not caught up. Resolved in one session: board orientation
  (`AHRS_ORIENTATION,15`), compass orientation, motor position remap, motor spin direction in AM32
  firmware, `RC2_REVERSED` for the TX16S pitch channel, and harmonic-notch filtering from a measured
  287 Hz hover fundamental. Notch cut gyro noise up to 76% and roll attitude error 92%. CG is
  slightly nose-heavy (~36 µs front/rear split) with the pack already as far back as it goes.
  Audible noise unchanged and still unexplained — the notch improves control quality, not acoustics.
  Compass recalibrated outdoors, clearing the `Check mag field` prearm. Battery capacity corrected
  from a `3300` default to the actual 1300 mAh and a low-voltage Land failsafe added on
  sag-compensated voltage, after a flight ended at 2.95 V/cell with no failsafe configured.
  AUTOTUNE not yet run.

## Links

- Frame — GEPRC GEP-CL35 V3 (AliExpress): <https://www.aliexpress.us/item/3256810368292627.html>
- FC — MicoAir H743 v2 — _link TBD_ (supersedes the TAKER F722 AIO originally planned)
- Motors — GEPRC SPEEDX2 2105.5 2450KV (AliExpress): <https://www.aliexpress.us/item/3256812397590001.html>
- Props — HQProp Duct-T90MMX3 (AliExpress): <https://www.aliexpress.us/item/3256809907108000.html>
- RX — RadioMaster RP3 ELRS (AliExpress): <https://www.aliexpress.us/item/3256805325327886.html>
- GPS — HGLRC M100-5883 (AliExpress): <https://www.aliexpress.us/item/3256809025534880.html>
- MTF-01 optical flow + ToF (AliExpress): <https://www.aliexpress.us/item/3256809389865494.html>
- TOF400C VL53L1X (AliExpress): <https://www.aliexpress.us/item/3256806637257364.html>
- AM32 configurator: <https://github.com/am32-firmware/am32-configurator>
- UAV Log Viewer (`.bin` review, better than Mission Planner's): <https://plot.ardupilot.org>
