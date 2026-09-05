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
| Radio | Complete — **confirmed in params 2026-08-02** (see note) |
| ESC (all-at-once) | Complete |

**Radio calibration, 2026-08-02.** The 2026-07-25 param snapshot showed `RC1`–`RC4` at
`MIN 1100 / MAX 1900 / TRIM 1500` — untouched ArduPilot defaults — despite this table recording the
calibration as complete. It had evidently been run but never written. Re-run and saved: sticks now
read `988`/`2011` with `RC3_TRIM = 988`, which is what a committed calibration looks like on ELRS.

Worth knowing that this would **not** have shown up as a switch problem: `RCx_OPTION` and
`FLTMODE_CH` both evaluate raw PWM, so the arm/mode/beeper switches work correctly regardless of
the endpoint params. Only the sticks were affected. Check `RC1_MIN`/`RC1_MAX` against `1100`/`1900`
as a quick tell for an unsaved calibration.

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

- [ ] **Battery monitor — configured, not yet calibrated.** `BATT_MONITOR = 4` (analog PM02) with
  `BATT_VOLT_MULT = 18.18` / `BATT_AMP_PERVLT = 36.36` — both still the stock defaults. Calibrate
  voltage against a meter before trusting the failsafe; a miscalibrated monitor is worse than none,
  since a low read trips a failsafe in flight.
  - `BATT_CAPACITY = 3300` but the packs on hand are **4500 mAh** — fix before relying on
    consumed-mAh reporting.
- [ ] **Battery failsafe thresholds — set, worth a second look.** `BATT_LOW_VOLT = 14.4` (3.6 V/cell,
  → RTL) and `BATT_CRT_VOLT = 14.0` (3.5 V/cell, → Land), `BATT_LOW_TIMER = 10`. Only 0.4 V apart,
  so under sag the low and critical actions can fire in quick succession. Widen the gap once real
  hover current is known.
- [ ] **Throttle failsafe — params set, test outstanding.** `FS_THR_ENABLE = 1` (RTL on RC loss),
  `FS_THR_VALUE = 975`. Bench-test by powering down the TX and confirming the mode flips.
- [x] **Switch channel map — done 2026-08-02.** Arm CH5 / mode CH6 / beeper CH7, shared with the
  CL35. See §11 for the map and why mode cannot live on CH5.
- [x] **Arm method — switch, `RC5_OPTION = 153`.** Verified on the bench: flipping the switch
  produces a specific pre-arm rejection rather than silence, which exercises the full chain.
  Note `ARMING_RUDDER = 2` leaves rudder arm *and* disarm live as a parallel path alongside the
  switch; set to `1` (arm only) or `0` if that second path isn't wanted.
- [ ] **Flight modes.** `FLTMODE1`–`FLTMODE6` are all `0`, so every position of the CH6 switch is
  Stabilize. Deliberate for now — the airframe isn't tuned, so Stabilize is the only mode in use.
  Suggested when that changes: `FLTMODE1 = 0` (Stabilize), `FLTMODE4 = 2` (AltHold),
  `FLTMODE6 = 5` (Loiter), with RTL on its own switch (`RCx_OPTION = 4`).
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

### Payload planning note — updated 2026-08-17

**The payload is now a VLP-16 Lite on a single body-slung mount; the RoboSense Airy is dropped**
(price never came down, import regulation unfavourable, and the puck is already on hand). Rationale
and mount open-items live in the [project README](README.md#payload--vlp-16-lidar).

The port consequence changes shape. The earlier note reserved TELEM3 (or GPS2 as a serial) for an
Airy companion link. That reservation still stands and is still worth keeping free — but it is no
longer the binding constraint, because:

- The 6C has **no Ethernet** (that's the 6X), and the VLP-16 talks **RJ45 to a host NIC**. There is
  no port on this FC that can accept the sensor at all.
- So the topology is **sensor → interface box → companion computer**, with the FC seeing only a
  MAVLink serial link to that companion. The lidar never touches the autopilot.
- The interface box needs **12 V**; Ethernet does not power the sensor. That is a new rail on this
  airframe (4S pack → 12 V BEC), not a port assignment.

TELEM3/GPS2 therefore gets reserved for the **companion computer's MAVLink link**, which is a
low-bandwidth serial connection — a much easier fit than the original Airy assumption.

---

## 11. Switch channel map — shared with the CL35

**Decided and applied 2026-08-02 — live on both the X500 and the CL35.** Both aircraft use one
cloned TX16S model, so the channel map is identical:

| Function | Channel | Parameter |
|---|---|---|
| **Arm / disarm** | CH5 (AUX1) | `RC5_OPTION = 153` |
| **Flight mode** | CH6 (AUX2) | `FLTMODE_CH = 6`, `RC6_OPTION = 0` |
| **Beeper** (Lost Vehicle Sound) | CH7 (AUX3) | `RC7_OPTION = 30` |

CL35 side of this: [`../cinelog35-tof/ardupilot_setup.md`](../cinelog35-tof/ardupilot_setup.md).

### Cloning the model

Model match is on, so a straight clone leaves both aircraft answering the same model — **change the
Model ID** on the copy. Packet rate is per-model too: X500 runs 150 Hz, CL35 250 Hz, so re-set it
after cloning rather than inheriting.

The X500 has `BRD_SAFETY_DEFLT = 1` (M10 safety button must be pressed) where the CL35 has `0`.
Same switch map, different pre-arm ritual — expect `PreArm: Hardware safety switch` here and not
on the CL35.

### Why mode is *not* on CH5

ExpressLRS sends **CH5 / AUX1 with every packet** so a disarm never waits on a slow AUX slot. The
cost of that guarantee is that AUX1 is **1-bit — two positions — in every switch mode** (Hybrid,
Wide, and Full Resolution alike). [ELRS switch config](https://www.expresslrs.org/software/switch-config/).

ArduPilot reads `FLTMODE_CH` as six PWM windows:

| Position | PWM | Parameter |
|---|---|---|
| 1 | ≤ 1230 | `FLTMODE1` |
| 2 | 1231–1360 | `FLTMODE2` |
| 3 | 1361–1490 | `FLTMODE3` |
| 4 | 1491–1620 | `FLTMODE4` |
| 5 | 1621–1749 | `FLTMODE5` |
| 6 | ≥ 1750 | `FLTMODE6` |

A 1-bit channel only ever lands near 1000 or 2000, so mode on CH5 reaches `FLTMODE1` and `FLTMODE6`
and nothing else. A 3-position switch mixed to CH5 **fails silently** — the middle detent is
rounded away by ELRS and the FC never sees position 3. CH6+ is 6-position in Hybrid / 64-position
in Wide, which is where a real mode switch belongs.

Putting arm on AUX1 also aligns ArduPilot with ELRS's own armed-state detection, which keys off
AUX1 regardless of what the FC does with it.

### Aux switch thresholds

`RCx_OPTION` functions use 3-state logic, independent of the 6-window mode table: **low < 1200**,
**middle 1200–1800**, **high > 1800**. A 2-position switch at ELRS endpoints (~988 / ~2012) hits
low and high cleanly.

---

## Config management

Params dump as plain `NAME,VALUE` text via Full Parameter List → Save to File. Diffable and version-controllable. Snapshot before every change session — parameters survive firmware upgrades, so a bad param is stickier than a bad flash. Loading a file only stages changes; you still have to Write Params.

**SITL** (`sim_vehicle.py -v ArduCopter`) runs the full flight stack in simulation and connects to a ground station exactly like real hardware. Useful for rehearsing param changes and mission plans without a battery in the room.