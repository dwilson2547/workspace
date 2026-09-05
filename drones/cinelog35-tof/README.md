---
tier: reference
domain: drones
---

# CineLog 3.5 — ToF indoor autonomy build

**Planned custom build.** A 3.5" ducted quad (GEPRC CineLog 35 airframe) fitted with a Time-of-Flight
sensor suite and a microcontroller companion, aimed at **assisted or fully autonomous
indoor flight** — position hold and obstacle avoidance without GPS. This is the first from-parts
build in the domain (the X500/Pavo craft are kits/BNFs).

Status: **assembled and wired except the ESP32 (2026-08-17).** All sensors, both I²C muxes and the
HDZero VTX are in and connected. The **only remaining hardware is the ESP32-S3** — wire it to the
sensor stack and to the FC — after which it's ArduPilot configuration for the ESP32 and the MTF-01.

⚠ **It has not been powered up since the modifications.** That first power-up is a milestone in its
own right, not a formality — see [first power-up](#-first-power-up-after-rework).

The airframe already flies: first hovers outdoors **2026-08-02**, with board orientation, motor
mapping, RC direction and gyro filtering all resolved — see
[FC configuration](#flight-controller-configuration).

⚠ **The Raspberry Pi is out.** The ESP32-S3 is now the companion — see
[sensor / autonomy architecture](#sensor--autonomy-architecture). The live configuration record
is [`ardupilot_setup.md`](ardupilot_setup.md); where the two disagree, that file wins.

## Concept

Indoor, GPS-denied autonomy on a small ducted platform:

- **Optical flow + down-facing ToF** (MicoAir MTF-01) gives the flight controller a velocity/altitude
  reference for stable position hold without GPS.
- **A ring of 11 ToF rangefinders** (VL53L1X) gives the companion computer a coarse obstacle field
  around the craft (surround + up/down), which it turns into avoidance / autonomous navigation and
  feeds back to the FC as setpoints.
- The ducts make close-quarters flight (bumping walls, prop guards) survivable.

## Build spec

| Item | Part | Notes |
|------|------|-------|
| Frame | GEPRC GEP-CL35 V3, 3.5" ducted (CineLog 35, O4-ready) | ducted cinewhoop airframe; **plastic, not CF** (verified by continuity test) |
| Flight controller | **MicoAir H743 v2 AIO** (STM32H743) | BMI088 + BMI270 IMU, DPS310 baro, **no onboard compass**. Built-in **AM32 4-in-1 ESC** (fw 2.19), DShot600 |
| Motors | GEPRC SPEEDX2 2105.5 2450 KV (×4) | 4S-class |
| Props | HQProp Duct-T90MMX3 (90 mm / 3.5" ducted tri-blade) | 6 pairs on hand |
| RC link | **RadioMaster RP3 ELRS** (CRSF) | bind phrase `dwdrones`; 250 Hz, telem 1:4 |
| GPS / compass | HGLRC M100-5883 (M10 GPS + QMC5883 compass) | optional outdoor; indoor nav is ToF/flow-based |
| Optical flow + ToF | **MicoAir MTF-01** | down-facing flow + single-point lidar for position/altitude hold |
| Obstacle ToF array | **11× TOF400C (VL53L1X)**, up to ~4 m | surround obstacle sensing; **mounted and wired** |
| I²C expansion | **2× PCA9548A mux** | **mounted and wired** — solves the 0x29 address collision (8 channels each, 11 sensors) |
| Companion computer | **Waveshare ESP32-S3-Zero** | reads the ToF ring through the muxes, feeds the FC. _Replaces the planned Raspberry Pi 3B._ |
| Remote ID | Dronetag BS | standalone GNSS + BLE; no UART to the FC |
| Video / FPV | **HDZero Whoop V2 VTX + HDZero Micro V3 camera** | digital HD; MSP DisplayPort OSD off the FC |
| Battery | **4S 1300 mAh** (XT30/XT60) | in use; 15.2 V start, 14.2 V min under a 52 A peak |
| Autopilot stack | **ArduPilot 4.7.0 (ArduCopter)** | native proximity/flow/rangefinder support plus a MAVLink companion interface is the whole reason |

Parts on hand vs. still-to-buy: [`inventory.md`](inventory.md).

## Flight controller configuration

The FC had to be mounted **square** on a frame whose mounting pattern expects **diamond**, and
**inverted**. Everything below follows from that. Settled 2026-08-02 and flight-verified.

| Param | Value | Why |
|-------|-------|-----|
| `AHRS_ORIENTATION` | `15` (`ROLL_180_YAW_315`) | board mounted inverted and 45° off the airframe nose |
| `COMPASS_EXTERNAL` | `1` | M100-5883 is on a mast — `AHRS_ORIENTATION` does **not** apply to it |
| `COMPASS_ORIENT` | `2` (`YAW_90`) | auto-derived by `COMPASS_AUTO_ROT,2` once the board frame was right. ⚠ **unverified** — see below |
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

> ⚠ **`COMPASS_ORIENT` is unverified.** `2` is the value auto-derived here, but a `4` was also
> recorded against this airframe and the GPS mast has been disturbed since. Re-derive it with
> `COMPASS_AUTO_ROT` before the next flight rather than trusting either number.

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

## Sensor / autonomy architecture

**The Raspberry Pi 3B is dropped; the ESP32-S3 is the companion.** The ToF ring is a fixed-rate
stream of 11 scalar distances — a few hundred bytes per second of work — and reading eleven I²C
sensors through two muxes and emitting `OBSTACLE_DISTANCE` is comfortably inside an ESP32-S3's
budget. Everything the Pi was carrying for that job (Linux, ~1 A of draw and brownout risk, its own
BEC, WiFi, mavlink-router, boot time) was overhead paid for a task that never needed it. On a 3.5"
airframe that mass and current matter.

```
        [11× VL53L1X ToF ring]                      [MicoAir MTF-01]
                  |                              (flow + down ToF, MAVLink)
                  | I2C                                     |
                  v                                         |
          [2× PCA9548A mux]                                 |
                  |                                         |
                  v                                         v
        [ESP32-S3-Zero companion] --UART/MAVLink--> [MicoAir H743 v2 AIO] --> motors/ESC
          OBSTACLE_DISTANCE                            ArduPilot
                                                       + ELRS (RP3)
```

- **MTF-01 → FC:** the flow/lidar module talks to the FC directly over MAVLink, giving
  loiter/position-hold with the ESP32 out of the loop. This is the "assisted" layer, and it works
  even if the companion is unpowered.
- **ToF ring → ESP32 → FC:** the 11 VL53L1X hang off two PCA9548A muxes, the ESP32 sweeps them and
  publishes the obstacle field to ArduPilot as `OBSTACLE_DISTANCE` messages. ArduPilot's own
  proximity/avoidance layer does the rest — the companion is a **sensor driver, not a navigator**.
  This is the "autonomous" layer.

That last point is the real architectural change and it is a simplification: with ArduPilot rather
than Betaflight/INAV, obstacle avoidance is a **built-in consumer of a standard message**, so the
companion never has to compute setpoints or override the pilot. It only has to describe the world.

### ⚠ Design notes still open

- ~~**VL53L1X I2C address collision.**~~ **Resolved — 2× PCA9548A muxes, mounted and wired.** Every
  VL53L1X powers up at the same address (`0x29`) and a single mux has only 8 channels, so 11 sensors
  needed two. XSHUT sequencing was the alternative and was not taken.
- **Sensor placement/coverage.** 11 sensors ≈ front/back/left/right + 4 diagonals + up + down (with
  one spare / redundancy). Physically mounted — **record the actual channel→direction map**, because
  ArduPilot needs each distance tagged with a yaw angle and that mapping is currently only in the
  wiring.
- **MAVLink IDs will collide if left alone.** Both the MTF-01 *and* the ESP32 speak MAVLink into the
  FC on separate serial ports. The MTF-01 already needs its `mav_id` moved off `1` on recent
  firmware (see [`ardupilot_setup.md`](ardupilot_setup.md)); give the ESP32 a third distinct sysid
  rather than discovering the clash as intermittent dropouts.
- **I²C bus length and noise.** Eleven sensors, two muxes and the compass on one bus in a 3.5"
  airframe full of ESC phase leads. Keep runs short and away from the phase wires; if the bus is
  flaky, that's the first suspect, not the sensors.
- **Power budget.** ESP32 + 11 ToF + 2 muxes off the FC's 5 V BEC — much lighter than the Pi's ~1 A,
  but confirm the rail still has headroom with the RP3 and M100 on it too.
- **Total AUW** with the sensor ring, ESP32 and HDZero gear — and therefore the battery choice, which
  is still open.

## Video — HDZero

The frame was bought O4-ready, but the build went **HDZero** instead. What's on hand:

**Connected 2026-08-17** — camera to VTX, VTX to the FC. Not yet powered.

| Item | Notes |
|---|---|
| **HDZero Whoop V2 VTX** (bundle) | the air-side transmitter — **fitted and wired** |
| **HDZero Micro V3 camera** | bought separately — the bundle ships a **14 mm** camera and the CL35 wants **19 mm**. **Fitted** |
| **MIPI cables — 40 mm (bundled), 2× 80 mm, 1× 120 mm** | the 80 mm was the fit; the 40 mm was too short. Leftovers give a **full length array for the next build** — and the spare **14 mm camera** suits the [Carnage 4.5](../carnage-45/README.md) |
| **HDZero ProBox+** | ground side — the ecosystem is complete |

Two things this pulls into the FC config, both already half-done:

- **OSD is MSP DisplayPort.** `SERIAL2_PROTOCOL = 42` is already set on the VTX port. ⚠ But
  `OSD_TYPE` is still `1` (MAX7456 — the analog OSD chip), and MSP DisplayPort needs **`OSD_TYPE = 5`**.
  Expect a blank canvas until that's changed; verify the value against the FC's parameter list in
  Mission Planner rather than trusting this line.
- **⚠ The VTX connector was carrying the Dronetag.** [`ardupilot_setup.md`](ardupilot_setup.md)
  records the BS being fed from the 12 V pin on the VTX connector, with a note that an HD air unit
  would force a soldered 12 V pigtail instead. **That moment has arrived** — the HDZero VTX wants
  that connector.
- **✅ The Whoop V2's input range is now known: 3–12.6 V (1S–3S).** So this FC's regulated 12 V pad
  suits it — **but with only 0.6 V of headroom**. Answered 2026-09-01, the expensive way: the same
  VTX on the [Reliant Y6](../f121-reliant-v2/README.md#-vtx-failure--the-video-power-pad-is-pack-voltage)
  was destroyed by an HGLRC AIO whose video pad passes raw pack voltage (16.8 V on 4S). Nothing to
  change here, but **fit the capacitor HDZero recommends**, and note the VTX has **no
  reverse-polarity protection** — worth a continuity check before that first power-up.

### ⚠ First power-up after rework

The airframe has been through significant changes since it last had power — VTX and camera added, the
sensor ring and muxes wired in, and the 12 V feed reworked. Treat the first power-up as a test, not a
step:

- **Power on a current-limited bench supply if you have one**, not a flight pack. A wiring fault
  shows up as a current spike you can catch, instead of as smoke.
- **Props off**, obviously, and expect nothing to be configured yet — the MTF-01, the proximity ring
  and `OSD_TYPE` are all still at defaults.
- **Check the 12 V rail before trusting it** — the VTX and the Dronetag BS both want a supply and the
  BS was originally fed from the VTX connector. Confirm what each is actually drawing from now.
- **Expect a blank OSD.** `OSD_TYPE` is still `1` (MAX7456 analog) and HDZero needs `5` (MSP
  DisplayPort). A blank canvas on first power-up is the known state, not a fault — don't go hunting a
  wiring problem for it.
- Confirm the FC still enumerates GPS and compass at boot, since that loom was disturbed.

## Status

- [x] Autopilot stack chosen — **ArduPilot**
- [x] Airframe assembled + FC flashed (MicoAir H743 v2 AIO, ArduPilot 4.7.0)
- [x] ELRS bound (RP3, phrase `dwdrones`), calibrated; switch map applied
- [x] GPS + compass enumerating (after the pinout fight — see `ardupilot_setup.md`)
- [x] Board orientation + accel calibration correct
- [x] Motor order and spin directions correct
- [x] Harmonic notch configured against measured hover frequency
- [x] First hover (outdoors, Stabilize) — 2026-08-02
- [x] Compass recalibrated — field stable at 502 mGauss, sd 11
- [x] Battery capacity + low-voltage failsafe configured (Land, sag-compensated)
- [x] **VL53L1X ring addressing solved** — 2× PCA9548A, mounted and wired
- [x] **All 11 ToF sensors + both muxes mounted and wired**
- [x] **HDZero camera + VTX fitted and wired** (80 mm MIPI cable) — 2026-08-17
- [ ] **ESP32-S3 wired to the sensor stack** ← the last hardware job
- [ ] **ESP32-S3 wired to the FC** (UART, MAVLink)
- [ ] **First power-up since the rework** — see the cautions above
- [ ] **ArduPilot configured for the ESP32** (`PRX1_TYPE = 2`, serial protocol/baud, distinct sysid)
- [ ] **ArduPilot configured for the MTF-01** (`FLOW_TYPE`, `RNGFND1_*`, and the `mav_id` gotcha)
- [ ] `OSD_TYPE` → **5** so the HDZero canvas actually draws
- [ ] Confirm how the Dronetag BS is being fed now that the VTX has the connector
- [ ] Buzzer fitted to the BZ pad (`RC7_OPTION = 30` is set but inert without one)
- [ ] Disarm tested (arming verified on the bench; the low → disarm transition never has been)
- [ ] AUTOTUNE — filtering is in place and tracking is clean
- [ ] Confirm mag prearm is clear on a charged pack (a battery failure may have masked it)
- [ ] **Battery failsafe verified in flight** — configured, but has never triggered, so the
      threshold and timer are untested
- [ ] Audible noise characterised (mic + acoustic FFT)
- [ ] `COMPASS_ORIENT` re-verified — see the note in [FC configuration](#flight-controller-configuration)
- [ ] MTF-01 position hold working (assisted layer)
- [ ] Obstacle avoidance live off the ToF ring (autonomous layer)
- [ ] First indoor hover

Fuller pre-flight checklist — calibration, compass orientation, harmonic notch, motor direction — is
in [`ardupilot_setup.md`](ardupilot_setup.md#remaining-work).

## Build log

- **2026-08-17** (later) — **HDZero VTX connected; the airframe is now fully assembled and wired
  except the ESP32.** The longer MIPI cable arrived and the camera-to-VTX run is made up. Nothing has
  been **powered up since the modifications**, so the next session is a careful first power-up
  (cautions recorded above) rather than straight into configuration. Remaining hardware work is a
  single item: wire the ESP32-S3 to the mux stack and to the FC.
- **2026-08-17** — **~99 % assembled.** All 11 VL53L1X and both PCA9548A muxes are mounted and wired
  in the airframe. Two decisions recorded rather than made today, because the build has moved past
  them: the **Raspberry Pi 3B is dropped in favour of the ESP32-S3** as the companion — the ring is a
  few hundred bytes/sec of scalar distances, so Linux, ~1 A of draw, a dedicated BEC and a boot
  sequence were all overhead — and **video is HDZero, not DJI O4**. HDZero kit is a Whoop V2 VTX
  bundle plus a separately-bought **Micro V3** camera (the bundle's 14 mm camera is the wrong size;
  the CL35 takes 19 mm), a **ProBox+** on the ground, and a spread of MIPI cables — the bundled 40 mm
  was too short, so 2× 80 mm and 1× 120 mm were ordered; the 80 mm should be the fit and the rest
  become a length array for the next build. Remaining work is now narrow: **wire the ESP32 to the
  sensor stack and to the FC, then configure ArduPilot to talk to the ESP32 and the MTF-01.** Also
  flagged: the HDZero VTX claims the connector the Dronetag BS was drawing 12 V from, which the
  earlier port notes predicted would happen.
- **2026-08-10** — VL53L1X modules arrived. Connected the first TOF400C to a Waveshare
  ESP32-S3-Zero for bench testing (`SDA=GPIO8`, `SCL=GPIO9`). Added the
  [`vl53l1x_probe`](firmware/vl53l1x_probe/vl53l1x_probe.ino) sketch to verify I2C detection,
  sensor initialization, live range, signal strength, and range status before companion-firmware
  development.
- **2026-08-02** — **First flights.** MicoAir H743 v2 AIO on ArduPilot 4.7.0, built-in AM32
  4-in-1 ESC. Resolved in one session: board orientation
  (`AHRS_ORIENTATION,15`), compass orientation, motor position remap, motor spin direction in AM32
  firmware, `RC2_REVERSED` for the TX16S pitch channel, and harmonic-notch filtering from a measured
  287 Hz hover fundamental. Notch cut gyro noise up to 76% and roll attitude error 92%. CG is
  slightly nose-heavy (~36 µs front/rear split) with the pack already as far back as it goes.
  Audible noise unchanged and still unexplained — the notch improves control quality, not acoustics.
  Compass recalibrated outdoors, clearing the `Check mag field` prearm. Battery capacity corrected
  from a `3300` default to the actual 1300 mAh and a low-voltage Land failsafe added on
  sag-compensated voltage, after a flight ended at 2.95 V/cell with no failsafe configured.
  AUTOTUNE not yet run.
- **2026-07-16** — Build planned; core parts (frame, FC, motors, props, RP3, M10 GPS, MTF-01, 11×
  VL53L1X) being ordered. Battery and companion computer not yet selected. Open decisions captured
  above.

## VL53L1X bench test

Wire one TOF400C module to the Waveshare ESP32-S3-Zero:

| TOF400C | ESP32-S3-Zero |
|---------|---------------|
| VIN | 3V3 |
| GND | GND |
| SDA | GPIO8 |
| SCL | GPIO9 |

Install the Arduino library **VL53L1X by Pololu**, open
[`firmware/vl53l1x_probe/vl53l1x_probe.ino`](firmware/vl53l1x_probe/vl53l1x_probe.ino), select the
ESP32-S3 board, and upload. Open the serial monitor at **115200 baud**.

A working module reports an I2C device at `0x29`, passes VL53L1X initialization, and prints changing
distance readings as a target moves. `range valid` readings with a non-zero signal rate provide a
stronger check than I2C detection alone.

## Links

- Frame — GEPRC GEP-CL35 V3 (AliExpress): <https://www.aliexpress.us/item/3256810368292627.html>
- FC — MicoAir H743 v2 AIO — _link TBD_
- AM32 configurator: <https://github.com/am32-firmware/am32-configurator>
- UAV Log Viewer (`.bin` review, better than Mission Planner's): <https://plot.ardupilot.org>
- Motors — GEPRC SPEEDX2 2105.5 2450KV (AliExpress): <https://www.aliexpress.us/item/3256812397590001.html>
- Props — HQProp Duct-T90MMX3 (AliExpress): <https://www.aliexpress.us/item/3256809907108000.html>
- RX — RadioMaster RP3 ELRS (AliExpress): <https://www.aliexpress.us/item/3256805325327886.html>
- GPS — HGLRC M100-5883 (AliExpress): <https://www.aliexpress.us/item/3256809025534880.html>
- MTF-01 optical flow + ToF (AliExpress): <https://www.aliexpress.us/item/3256809389865494.html>
- TOF400C VL53L1X (AliExpress): <https://www.aliexpress.us/item/3256806637257364.html>

### Reference

- ArduPilot — MicoAir MTF-01 optical flow setup: <https://ardupilot.org/copter/docs/common-mtf-01.html>
- ArduPilot — simple object avoidance (proximity / `OBSTACLE_DISTANCE`):
  <https://ardupilot.org/copter/docs/common-simple-object-avoidance.html>
- MTF-01 user manual (MicoAssistant, output protocols): <https://github.com/micoair/MTF-01_USER_MANUAL>
