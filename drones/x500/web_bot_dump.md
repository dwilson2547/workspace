# Holybro X500 V2 — Pixhawk 6C / ArduCopter configuration record

**Date:** 2026-07-25
**Airframe:** Holybro X500 V2, quad X
**FC:** Pixhawk 6C (FMUv6C)
**Firmware:** ArduCopter (stable)
**Ground station:** Mission Planner (Windows during setup, Linux laptop thereafter)
**Status:** Bench configuration complete. Not yet flown.

---

## 1. Hardware and port assignment

| Peripheral | Port | Notes |
|---|---|---|
| ESCs / motors 1–4 | **I/O PWM OUT 1–4** | Maps to `SERVO1`–`SERVO4`. PWM protocol. |
| Holybro M10 GPS + compass | GPS1 | External mag on the same GH connector (I2C) |
| RadioMaster RP3 (ELRS 2.4GHz) | TELEM1 | CRSF, `SERIAL1` |
| SiK v3 telemetry radio (915MHz) | TELEM2 | MAVLink2, `SERIAL2` |
| Power module | POWER1 | See §8 — not yet configured |

### Output bank note

On the 6C, ArduPilot maps `SERVO1`–`SERVO8` to the I/O bank and `SERVO9`–`SERVO14` to the FMU bank. The I/O bank is **PWM / OneShot only** — no DShot.

Motors are currently on I/O and running PWM. To move to DShot later:

1. Physically move the signal leads to FMU PWM OUT 1–4
2. `SERVO9_FUNCTION = 33`, `SERVO10_FUNCTION = 34`, `SERVO11_FUNCTION = 35`, `SERVO12_FUNCTION = 36`
3. `SERVO1_FUNCTION` through `SERVO4_FUNCTION` = 0
4. Set the DShot rate, reboot

Worth doing eventually: bidirectional DShot provides per-motor RPM to drive the dynamic harmonic notch, which is the single biggest vibration-handling improvement available on a 10" airframe carrying payload.

---

## 2. Motor mapping — verified

ArduPilot quad X numbering (**differs from Betaflight**):

| Motor | Position | Rotation | Mission Planner test letter |
|---|---|---|---|
| 1 | Front right | CCW | **A** |
| 2 | Rear left | CCW | **C** |
| 3 | Front left | CW | **D** |
| 4 | Rear right | CW | **B** |

Mission Planner's motor test letters run **clockwise around the frame**, not in motor-number order. A → front right, B → rear right, C → rear left, D → front left.

**Verified 2026-07-25:** all four positions and rotation directions correct. Prop rotation matched to motor rotation and checked.

---

## 3. Frame

| Parameter | Value | Meaning |
|---|---|---|
| `FRAME_CLASS` | 1 | Quad |
| `FRAME_TYPE` | 1 | X |

---

## 4. RC — ELRS / CRSF on TELEM1

| Parameter | Value | Meaning |
|---|---|---|
| `SERIAL1_PROTOCOL` | 23 | RCIN (CRSF) |
| `BRD_SER1_RTSCTS` | 0 | CRSF has no hardware flow control |
| `RSSI_TYPE` | 3 | RSSI from receiver protocol |
| `RC_OPTIONS` | 256 | Suppress CRSF mode/rate messages |

Baud is auto-negotiated by the CRSF driver — leave `SERIAL1_BAUD` alone.

TELEM1 is a crossover connection: FC TX → RX RX, FC RX → RX TX. `SERIAL1_PROTOCOL` requires a **reboot** to take effect.

**Receiver side (RP3):**
- Packet rate 150Hz
- Telemetry ratio 1:4
- Failsafe mode: **No Pulses**
- Model match: enabled (multiple airframes bound to the same TX16S)

**Calibration:** radio calibration completed. Channel map AETR, matching ArduPilot's default `RCMAP`.

---

## 5. Telemetry — SiK radio on TELEM2

| Parameter | Value |
|---|---|
| `SERIAL2_PROTOCOL` | 2 (MAVLink2) |
| `SERIAL2_BAUD` | 57 (57600) |

Radio-side settings: air speed 64, ECC on, MAVLink framing, Op Resend on. Both radios must match on everything except NetID.

Ground station connects at **57600**, not 115200. Param download over the link takes 30–60s.

Never power a SiK radio without its antenna attached.

---

## 6. Calibrations completed

| Item | Status |
|---|---|
| Accelerometer (6-position + level) | Complete |
| Compass | Complete — offsets within range, external mag prioritised |
| Radio | Complete |
| ESC (all-at-once) | Complete |

---

## 7. Motor output tuning

| Parameter | Value | Notes |
|---|---|---|
| `MOT_SPIN_ARM` | _(record your value)_ | Lowest throttle where all four reliably start |
| `MOT_SPIN_MIN` | _(record your value)_ | `MOT_SPIN_ARM` + 0.03 |
| `MOT_THST_EXPO` | 0.65 | Already set prior to Initial Tune |
| `MOT_HOVER_LEARN` | 2 | Learn and save hover throttle in flight |

### Initial Tune Parameters wizard

- **Airscrew size:** 10 in (stock 1045 props)
- **Battery cell count:** 4S

The wizard scales rate PIDs and `INS_GYRO_FILTER` from prop diameter, and sets `MOT_BAT_VOLT_MAX` / `MOT_BAT_VOLT_MIN` from cell count. Output is a conservative, safe-to-hover tune — deliberately soft. Autotune sharpens it later.

---

## 8. Outstanding before first flight

- [ ] **Battery monitor.** `BATT_MONITOR = 4` for the analog PM02 (starting points: `BATT_VOLT_MULT` 18.18, `BATT_AMP_PERVLT` 36.364, then calibrate against a meter). The PM03D is I2C and needs a different monitor type — confirm which module shipped. A configured-but-miscalibrated monitor is worse than none, since 0V reads trip a failsafe.
- [ ] **Battery failsafe thresholds.** 4S: `BATT_LOW_VOLT` 14.0, `BATT_CRT_VOLT` 13.2
- [ ] **Throttle failsafe.** `FS_THR_ENABLE = 1` (RTL on RC loss). Bench-test by powering down the TX and confirming the mode flips.
- [ ] **Flight modes.** `FLTMODE_CH = 5` (default). Assign `FLTMODE1`–`FLTMODE6`. Suggested: Stabilize / AltHold / Loiter, with RTL on its own switch.
- [ ] **Arm method.** Either stick arming (throttle down + full right yaw, ~2s — works with no config) or a switch via `RCx_OPTION = 153`. **Do not use channel 5** — that's the flight mode channel in ArduPilot, unlike Betaflight.
- [ ] `ARMING_CHECK = 1` confirmed (never disabled — pre-arm failures were fixed rather than bypassed)

---

## 9. Issues encountered and resolutions

**`PreArm: Hardware safety switch`**
Press and hold the switch on the GPS module until the LED goes solid. Note that `ARMING_CHECK = 0` does **not** bypass this — the safety state is a hardware output inhibit downstream of the arming logic. To disable permanently: `BRD_SAFETY_DEFLT = 0` + reboot.

**`PreArm: Compass not calibrated`**
Resolved by running the compass calibration outdoors, away from steel.

**`Arm: Check mag field (xy diff:151>100)`**
ArduPilot compares the measured horizontal field against the World Magnetic Model for the GPS position. Southeast Michigan's horizontal component is ~180 mGauss, so a 151 error is gross distortion rather than drift.

Cause here: **indoors**. Rebar, benches, laptops, speaker magnets all bend the field this far. Expected to clear outdoors.

If it persists outdoors: check `COMPASS_OFS_X/Y/Z` (under 400 is healthy), disable the 6C's internal mags with `COMPASS_USE2 = 0` / `COMPASS_USE3 = 0`, and confirm the M10 is up on its mast and away from battery and ESC wiring. Do not bypass this check — a compass this wrong produces toilet-bowling in Loiter and an RTL that heads the wrong direction.

**Mission Planner param pages missing**
Config tab → left sidebar → Full Parameter List. If absent: not connected, or the layout is set to Basic (Config → Planner → Layout → Advanced). There is no GUI page for UART assignment; `SERIALx_PROTOCOL` is param-only. Full Parameter **Tree** groups by prefix if the flat list is unwieldy.

---

## 10. Next steps

1. Complete §8 outstanding items
2. First hover in **Stabilize** — low, brief, confirm it lifts level without yaw
3. AltHold, then Loiter once GPS lock and compass are trusted outdoors
4. Pull the dataflash `.bin` from the SD card. Check `VIBE` levels and clipping counts, and `RATE` desired-vs-actual, before committing to Autotune
5. Autotune on a calm day with space
6. Consider the FMU/DShot migration (§1) ahead of payload integration

### Payload planning note

The 6C has **no Ethernet** (that's the 6X). With TELEM1 on ELRS and TELEM2 on the SiK radio, the RoboSense Airy companion compute link will need TELEM3, or GPS2 repurposed as a serial. Worth reserving that port rather than filling it.

---

## Config management

Params dump as plain `NAME,VALUE` text via Full Parameter List → Save to File. Diffable and version-controllable. Snapshot before every change session — parameters survive firmware upgrades, so a bad param is stickier than a bad flash. Loading a file only stages changes; you still have to Write Params.

**SITL** (`sim_vehicle.py -v ArduCopter`) runs the full flight stack in simulation and connects to a ground station exactly like real hardware. Useful for rehearsing param changes and mission plans without a battery in the room.