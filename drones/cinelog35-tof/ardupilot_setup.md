# CL35 — ArduPilot Bringup Log

**Airframe:** CL35 (3.5" class, plastic/injection-molded frame — verified non-CF)
**FC:** MicoAir743v2-AIO (STM32H743, BMI088 + BMI270 IMU, DPS310 baro, **no onboard compass**)
**GPS/Mag:** HGLRC M100 (M10 GNSS + QMC5883L compass, 6-pin)
**RC:** RadioMaster RP3 (ELRS 2.4 GHz, CRSF)
**Remote ID:** Dronetag BS (standalone GNSS + BLE broadcast)
**Companion:** Waveshare **ESP32-S3-Zero** — *replaces the planned Raspberry Pi 3B (2026-08-17)*
**Video:** HDZero Whoop V2 VTX + HDZero Micro V3 camera (MSP DisplayPort OSD)
**Sensors:** MicoAir MTF-01 optical flow, 9× VL53L1X (8 ring + 1 up) on 2× PCA9548A — **all mounted and wired**

Status: RC bound and calibrated, accel calibrated, GPS + compass enumerating, compass orientation set. Switch channels mapped and arming verified on the bench (2026-08-02) — shares one TX16S model with the X500. **Assembled and wired as of 2026-08-17 except the ESP32** — sensor ring, muxes and the HDZero VTX are all in. ⚠ **Not powered up since that rework.** Not yet flown.

**Open bring-up work, in order:** wire the ESP32 to the mux stack → wire the ESP32 to the FC → configure ArduPilot for the ESP32 proximity feed and the MTF-01. Parameter targets in [§ Pending configuration](#pending-configuration--esp32-companion-and-mtf-01).

---

## Port allocation

| Port | Connector | Assigned to | Notes |
|---|---|---|---|
| UART3 / SERIAL3 | 6-pin GPS header (UART3 + I2C1) | M100 GPS + compass | Carries SDA/SCL on same connector |
| UART8 / SERIAL8 | broken out | RadioMaster RP3 (CRSF) | Vendor-listed alternate RC port |
| UART1 / SERIAL1 | UART1&UART6 combined | **ESP32-S3 companion** | was reserved for the Pi 3B; already `PROTOCOL = 2` (MAVLink2) @ 57600 |
| UART6 / SERIAL6 | UART1&UART6 combined | **MTF-01** (proposed) | currently `-1`. SBUS pin is inverted, hard-tied to RX6 — irrelevant for a plain UART peripheral |
| UART2 / SERIAL2 | DJI O3 / **HDZero** VTX | HDZero Whoop V2 VTX | `PROTOCOL = 42` (MSP DisplayPort) already set. **Pin 1 is 12 V** |
| UART7 / SERIAL7 | — | ESC telemetry (internal) | `PROTOCOL = 16` |
| 12 V rail (VTX conn.) | — | HDZero VTX (wired 2026-08-17) | ⚠ **confirm where the Dronetag BS is fed from now** — see below |

Dronetag BS is fully standalone — own GNSS, own BLE broadcast, no UART to the FC. Consumes no serial port and avoids ArduPilot's native OpenDroneID path (which would add RemoteID health to arming checks).

### The VTX connector conflict — resolved in hardware, unrecorded

The original design note under "Dronetag BS on the 12 V rail" said: *"If an O3/O4 air unit is ever
planned, solder a pigtail to the 12 V pad instead of consuming the VTX connector."* That contingency
arrived: the **HDZero Whoop V2 was wired in on 2026-08-17** and the VTX now has the connector.

⚠ **How the Dronetag BS ends up fed was decided at the bench and is not written down here.** Capture
it on the next session — it matters for the first power-up:

- **Where the BS draws from now** (soldered 12 V pigtail, or something else).
- **Combined draw**, if they do share. The BS is small; a VTX is not.

#### ✅ Whoop V2 input voltage — answered 2026-09-01, and it's tighter than it looks

**The HDZero Whoop V2 takes 3 – 12.6 V (1S–3S)** ([HDZero docs](https://docs.hd-zero.com/whoop-v2)).
So this FC's **12 V VTX pin is inside spec — but by 0.6 V**, which is margin, not comfort.

This was answered the expensive way: **the same VTX on the [Reliant Y6](../f121-reliant-v2/README.md#-vtx-failure--the-video-power-pad-is-pack-voltage)
was destroyed** by an HGLRC Specter's `7.4–26.4 V` (raw pack) video pad on 4S. The generalisable
rule — worth carrying to every future build — is that **an AIO's "digital VTX" pad is not a standard
rail**; it ranges from 5 V to raw pack depending on the board, and must be read off that board's
manual rather than assumed from the last build.

Consequences here:

- **This pairing is fine, leave it.** The MicoAir H743 v2 AIO regulates to 12 V and the VTX is rated to
  12.6 V.
- **Fit a capacitor at the VTX supply.** HDZero "strongly suggests" one at 3S; 12 V is 3S territory,
  and this airframe is about to see its first power-up after significant rework.
- **The VTX has no reverse-polarity protection** — it is permanently destroyed if wired backwards.
  Worth a continuity check before the first power-up rather than after.

### Port budget after the ESP32

Five of the AIO's UARTs are now spoken for (GPS, RC, companion, MTF-01, ESC telemetry) plus the VTX
port. This closes, but it closes **exactly** — there is no spare UART left for a telemetry radio.
That's consistent with the earlier decision to skip one, but the fallback that decision assumed
(Pi 3B WiFi + mavlink-router) **went away with the Pi**. Ground-station telemetry on this airframe is
now ELRS/CRSF back to the TX16S only. Worth deciding whether that's sufficient before first flight.

---

## Parameters changed

### RC / ELRS
```
SERIAL8_PROTOCOL = 23    # RCIN on UART8
SERIAL6_PROTOCOL = -1    # moved off default 23 to avoid conflict
RSSI_TYPE        = 3     # RSSI from receiver protocol
RC_PROTOCOLS     = 1     # all enabled
```
`SERIAL8_BAUD` left alone — protocol 23 auto-detects CRSF at 420 k. `SERIAL8_OPTIONS = 0`; CRSF is full duplex, no inversion.

ELRS packet rate: 250 Hz, telem ratio 1:4. Chosen for link margin over update rate — this is an autonomy testbed, not a freestyle rig.

### GPS
```
SERIAL3_PROTOCOL = 5     # GPS
SERIAL3_BAUD     = 115   # M100 native
GPS_TYPE         = 1     # auto
```
Note: `SERIAL3_BAUD` has no "auto"/0 option — 0 is out of range. 115 is correct for the M100. The UBlox driver baud-scans on top of this regardless.

### Compass
```
COMPASS_ENABLE   = 1
COMPASS_EXTERNAL = 1
COMPASS_ORIENT   = 4     # Yaw180 — GPS mounted backwards in stock TPU mount
```
GPS is physically reversed because the stock TPU mount put the connector cutout at the rear. `COMPASS_AUTO_ROT` (default 2) should detect and correct this during calibration, but `COMPASS_ORIENT` was set manually as a fallback so a marginal cal degrades gracefully.

### Orientation
`AHRS_ORIENTATION` — verify matches physical FC mounting. Must be set **before** accel calibration; the cal bakes in the frame. Board mounted SD-card-up for build access.

### Switch channels
```
FLTMODE_CH = 6     # mode on CH6/AUX2 — NOT CH5, see below
RC5_OPTION = 153   # ARM/DISARM on CH5/AUX1
RC6_OPTION = 0     # must be 0; CH6 is the mode channel
RC7_OPTION = 30    # Lost Vehicle Sound (beeper) on CH7/AUX3
```
Set 2026-08-02. Identical to the X500 so one TX16S model clones to both — full rationale and the
TX-side notes are in [`../x500/web_bot_dump.md`](../x500/web_bot_dump.md) §11.

`FLTMODE1`–`FLTMODE6` are all `0`, so every position of the CH6 switch is Stabilize. Deliberate —
the airframe isn't tuned yet and Stabilize is the only mode in short-term use.

---

## Pending configuration — ESP32 companion and MTF-01

**Not yet applied.** This is the target state for the next bring-up session, gathered from the
ArduPilot docs so the session isn't spent reading. **Verify every value against the FC's own
parameter list in Mission Planner before writing it** — parameter names drift between releases and
some of these are recorded from documentation rather than from this airframe.

### MTF-01 (optical flow + downward rangefinder)

Per [ArduPilot's MTF-01 page](https://ardupilot.org/copter/docs/common-mtf-01.html):

```
SERIAL6_PROTOCOL = 1     # MAVLink1  (currently -1)
SERIAL6_BAUD     = 115   # 115200
FLOW_TYPE        = 5     # MAVLink   (currently 0)
RNGFND1_TYPE     = 10    # MAVLink   (currently 0)
RNGFND1_MIN_CM   = 1
RNGFND1_MAX_CM   = 800
RNGFND1_ORIENT   = 25    # downward
```

Reboot after setting `RNGFND1_TYPE` — the rest of the `RNGFND1_*` parameters don't appear until it
has been set and the board restarted.

Two gotchas that will otherwise eat an evening:

- **⚠ On firmware 4.5.0+ the MTF-01 is not detected out of the box.** Its `mav_id` must be changed
  off `1` (the docs use `200`) with **MicoAssistant over an FTDI adapter**, *and* the FC's
  `SERIAL6_OPTIONS` must be set to `1024` ("don't forward MAVLink to/from"). Neither is discoverable
  from the FC side — the symptom is simply nothing appearing.
- **The module's own output protocol must be set to `mav-apm`** in MicoAssistant. It ships speaking
  something else (MSP among the options). So an FTDI adapter is a prerequisite for this task, not an
  optional debugging aid.

Post-install, `FLOW_ORIENT_YAW` is **independent of `AHRS_ORIENTATION`** and must describe the flow
sensor's forward direction relative to the *vehicle* — validate with slow low Loiter and watch for
toilet-bowling.

### ESP32-S3 companion (ToF ring → proximity)

The ESP32 presents the array to ArduPilot as a MAVLink proximity sensor, publishing
`OBSTACLE_DISTANCE`. ArduPilot's own avoidance layer consumes it — the companion computes no
setpoints. See [simple object avoidance](https://ardupilot.org/copter/docs/common-simple-object-avoidance.html).

**The full firmware spec is [`CL35 tof proximity handoff.md`](CL35%20tof%20proximity%20handoff.md)** —
message fields, mux discipline, range-status handling and failure behaviour. This section covers only
the FC-side parameters.

```
SERIAL1_PROTOCOL = 2     # MAVLink2 — already set
SERIAL1_BAUD     = 115   # currently 57; 57600 is probably enough for 9 scalars, but headroom is free
PRX1_TYPE        = 2     # MAVLink  (currently 0)
```

Then the avoidance behaviour itself (`AVOID_ENABLE`, `AVOID_MARGIN`, `PRX_*` filtering) — leave
these until the proximity data is visibly correct in Mission Planner's proximity view. Do not enable
avoidance on a feed that hasn't been eyeballed.

**On the ESP32 side, three things have to be right:**

1. **A distinct MAVLink system ID.** The MTF-01 is being moved to `200` and the FC is `1`. Pick a
   third value for the ESP32. Two peripherals sharing a sysid presents as intermittent, confusing
   dropouts rather than a clean failure.
2. **Each distance tagged with the correct yaw angle.** `OBSTACLE_DISTANCE` is a sector array — the
   physical channel→direction map (which mux, which channel, pointing where) is currently recorded
   only in the wiring loom. **Write it down before it's needed**, ideally as a table in this file.
   Only the **8 horizontal** sensors go in that array; the **up-facing** one has no valid bearing in a
   flat boundary and must go out as `DISTANCE_SENSOR` with `MAV_SENSOR_ROTATION_PITCH_90` instead.
   Give it a yaw and ArduPilot will brake sideways under a ceiling.
3. **Sane handling of no-return.** A VL53L1X pointed at open space, a dark surface, or through duct
   material returns invalid/out-of-range, not "far". Report those as *unknown* per ArduPilot's
   convention rather than as a large distance — an invalid reading published as "4 m clear" is how
   an avoidance system flies into something.

### Validation order

Bench, props off, in this order — each step is only debuggable if the one before it is known good:

1. ESP32 alone on the bench: all 9 sensors readable through both muxes, plausible values.
2. ESP32 → FC link up: FC sees a MAVLink heartbeat from the new sysid.
3. Proximity view in Mission Planner: wave a hand at each sensor, confirm the **right sector** lights
   up. This is where a wrong channel→yaw map shows itself, and it is much cheaper to find here.
4. MTF-01 separately: flow and rangefinder both reporting, `RNGFND1` tracking real height.
5. Only then enable avoidance.

---

## Issues encountered

### 1. GPS pinout mirrored between 743v2 and 743-AIO — *root cause of everything below*

The two boards use **opposite pin order** on the 6-pin GPS header:

| Board | Pin 1 → 6 |
|---|---|
| MicoAir743v2 (non-AIO) | GND, 5V, TX3, RX3, SCL, SDA |
| **MicoAir743-AIO** | **SDA, SCL, RX3, TX3, 5V, GND** |

The M100 shipped with a **crossed** cable (vendor compensating for exactly this). That cable was too short, so a straight-through cable from the FC accessory bag was substituted — undoing the vendor's fix.

**Symptoms:** module LED appearing to boot-loop, no GPS comms, no compass detected.

**Cause:** with straight-through wiring, GND landed on SDA and 5 V landed on SCL. The module was drawing power through the I2C pull-ups — enough to start, then brown out and reset. Classic signature.

**Partial fix:** reversing the cable corrected power only. Because reversal maps 1↔6, 2↔5, 3↔4, the symmetric pairs (power) landed correctly while TX/RX and SDA/SCL each swapped *with each other*:
- TX → TX, RX → RX (both wrong)
- SDA → SCL, SCL → SDA (both wrong)

**Final fix:** repinned two pairs at the module end — positions 3↔4 (TX/RX) and 5↔6 (SDA/SCL). Both GPS and compass enumerated immediately after.

**Lesson:** with the FC powered and cable unplugged, meter the header before trusting any cable. Both cables in the bin now look identical and only one works — tag them.

### 2. Diagnostic notes worth keeping

- **"No fix on the map" indoors is expected.** In Mission Planner check the HUD GPS status field instead: **"No GPS"** = FC not talking to module (wiring), **"No Fix"** = comms fine, no satellites (go outside).
- **`@SYS/uarts.txt` via MAVFTP** (Config → MAVFtp) shows per-UART TX/RX byte counters. RX = 0 proves a wiring fault rather than a parameter fault. Fastest way to isolate.
- **Erratic GPS LED at boot is often normal** — ArduPilot sweeping baud rates and pushing UBlox config looks a lot like a boot loop.
- **Compass detection happens at boot only.** Watch the Messages tab during startup; rescanning without a reboot proves nothing.

### 3. Corrections to earlier assumptions

- Baro on the AIO is **DPS310**, not SPL06 (that's the non-AIO).
- The AIO **does** break out UART8. On the non-AIO, UART8 is the internal Bluetooth module. The AIO has no Bluetooth telemetry — plan accordingly.
- The AIO's GPS header **does** carry I2C, so no separate compass wiring was needed.

---

## Design decisions and rationale

**FC orientation — SD card up.** ArduPilot has no USB mass-storage mode; SD access is MAVFTP-only, which is fine for Lua scripts and params but slow for large logs. Mitigation: run mavlink-router on the Pi 3B and pull logs over WiFi between flights, and keep heavy proximity logging on the Pi rather than the FC. Traded occasional card access for permanent UART access during build.

**Dronetag BS on the 12 V rail.** Keeps the 5 V BEC headroom for the M100 and RP3. **Do not tap 6S pack directly** — 25.2 V hot off the charger exceeds the BS's 17 V limit. If an O3/O4 air unit is ever planned, solder a pigtail to the 12 V pad instead of consuming the VTX connector.

**Companion switched from Pi 3B to ESP32-S3 (2026-08-17).** The job is reading 9 I²C rangefinders
through two muxes and emitting `OBSTACLE_DISTANCE` — a few hundred bytes per second of scalars. That
never needed Linux. What the Pi cost for it: **over 1 A with WiFi active** (higher on peaks, prone to
brownout, hence a dedicated BEC rather than sharing the FC's 5 V rail with the GPS and RX), the mass
of board plus BEC on a 3.5" airframe, a boot sequence before the sensor stack is alive, and a third
2.4 GHz radio in the RF layout below. The ESP32-S3-Zero has none of those properties and is already
the board the sensors were bench-tested on.

The architectural half of this matters more than the hardware: because the stack is **ArduPilot**,
avoidance is a built-in consumer of a standard message, so the companion is a **sensor driver, not a
navigator**. It never computes setpoints. That is what makes a microcontroller sufficient.

Two things the Pi was quietly also providing, now gone:

- ~~**Telemetry radio skipped** — Pi 3B WiFi + mavlink-router covers it at zero added weight.~~
  **⚠ No longer true.** With the Pi gone there is no WiFi bridge, no mavlink-router, and the AIO has
  no Bluetooth fallback. Ground-station telemetry is now **CRSF back to the TX16S only**. Decide
  before first flight whether that's acceptable — there is also no spare UART for a SiK.
- **Log retrieval.** The "pull logs over WiFi between flights" mitigation for the SD-card-up
  orientation decision (below) went with it. MAVFTP over USB is the fallback, which is what that
  decision was trying to avoid. Revisit if log wrangling becomes painful.

**Flight mode cannot live on CH5 — ELRS limitation, not an ArduPilot one.** ExpressLRS sends
CH5/AUX1 with every packet so a disarm never waits on a slow AUX slot, and the price of that
guarantee is that AUX1 is **1-bit — two positions — in every switch mode** (Hybrid, Wide, and Full
Resolution alike). ArduPilot reads `FLTMODE_CH` as six PWM windows (pos 1 ≤ 1230, 2 ≤ 1360,
3 ≤ 1490, 4 ≤ 1620, 5 ≤ 1749, 6 ≥ 1750), so mode on CH5 reaches only positions 1 and 6. A
3-position switch mixed to CH5 **fails silently** — ELRS rounds the middle detent away and the FC
never sees position 3. Hence arm on CH5 (where ELRS wants it, and where its own armed-state
detection looks), mode on CH6.

Aux functions use separate 3-state logic — low < 1200, middle 1200–1800, high > 1800 — so a
2-position switch at ELRS endpoints (~988 / ~2012) hits both ends with margin.

**Beeper hardware.** `NTF_BUZZ_PIN = 61` / `NTF_BUZZ_TYPES = 1` (bit 0 = built-in buzzer on a pin)
means the H743 v2 AIO's BZ pad, which needs a buzzer physically soldered to it. `MOT_PWM_TYPE = 0`, so
there's no DShot-beeper fallback either — when the motors move to DShot, `NTF_BUZZ_TYPES = 3` adds
bit 1 and beeps through the ESCs with no added hardware or weight, which is attractive on a 3.5".

A self-powered (battery-backed) buzzer gives two independent mechanisms covering different
failures: `RC7_OPTION = 30` needs the FC powered and the RC link alive — good for "it's in tall
grass 40 m away" — while the buzzer's own cell covers the pack ejecting or the FC dying on impact,
which is the actual lost-model case and precisely when the FC-driven beeper isn't available.

---

## RF layout

**Down to two 2.4 GHz radios** (ELRS, BLE beacon) since the Pi and its WiFi left the build — a
straight improvement, and the "force the Pi to 5 GHz" mitigation is no longer needed. Remaining
mitigations:

- **BS mounts top of stack**, unobstructed sky view — it has its own GNSS, so burying it degrades
  position quality and defeats the compliance purpose. Keep it clear of the ESP32 and the VTX, both
  of which are switching-noise sources.
- **⚠ The HDZero VTX is new to this layout.** It is a transmitter that was not here when this section
  was written. It's 5.8 GHz so it doesn't contend with ELRS or the beacon by frequency, but a
  transmitter inches from a receiver desenses by near-field coupling regardless of band. Include it
  in the bench validation below.
- **RP3 antennas orthogonal** (90°) — that's the point of diversity. Cross-polarize relative to the BS antenna.
- Frame is plastic, so RF transparency is a non-issue (verified by continuity test — CF reads conductive, plastic reads open).

**Bench validation before first flight:** note ELRS LQ/RSSI on the TX16S with everything else
unpowered, then bring up the **BS** and re-check, then the **HDZero VTX** and re-check. Repeat at
50–100 m. Any RSSI drop when a transmitter comes up = desense, move something. Testing them one at a
time is the point — bringing both up together tells you there's a problem but not which one.

---

## Remaining work

### Before first flight
- [x] Channel setup — arm CH5 / mode CH6 / beeper CH7 (2026-08-02)
- [ ] **Test disarm.** Arming was verified on the bench (switch high produced a specific pre-arm
  rejection rather than silence, which exercises the whole chain), but nothing has ever been armed,
  so the low → disarm transition has never actually run. `RCx_OPTION = 153` disarms
  **unconditionally** — no checks, no altitude guard. Arm on a pack with props off, confirm idle,
  flip low, confirm instant stop.
- [ ] **Buzzer.** `RC7_OPTION = 30` is set but no buzzer is fitted yet — the switch is inert until
  one is on the BZ pad. Self-powered unit on order. On install, if it's silent or stuck on, flip
  `NTF_BUZZ_ON_LVL` from `1` to `0` (active-high vs active-low); that's the usual culprit, not a
  bad buzzer. See "Beeper hardware" below.
- [ ] `ARMING_RUDDER = 2` — decide deliberately. Leaves throttle-down + full-right-yaw live as a
  parallel arm *and* disarm path alongside the switch. `1` = arm only, `0` = off.
- [ ] Arming checks, failsafes
- [ ] Compass calibration outdoors, away from steel/tools/laptop/phone
- [ ] Verify `COMPASS_ORIENT` after cal — if auto-rot changed it from 4, the mount isn't a clean 180° or the cal was poor. Redo rather than accept.
- [ ] Ground heading test: walk the aircraft north, then east, confirm HUD heading tracks reality
- [ ] Confirm GPS patch antenna still faces **up** in the reversed TPU mount
- [ ] Motor order / direction, DShot config, prop-off throttle test
- [ ] Foam over the DPS310 baro — light-sensitive and sitting in prop wash on a 3.5"
- [ ] Rubber grommets in the 30.5 mm mount, standoffs not overtorqued

### After first hover
- [ ] Check `VIBE` levels before trusting the EKF
- [ ] `COMPASS_MOT` current compensation — M100 sits close to an AIO carrying full pack current
- [ ] **Harmonic notch from real FFT data.** Plastic frame + Pi mass = lower resonant frequencies, likely 30–80 Hz, close to control bandwidth. Do an `INS_LOG_BAT_MASK` batch-sample hover and configure `INS_HNTCH_*` off measured data. Do not run defaults on this airframe.
- [ ] AutoTune

### Sensor stack — the current front line
- [x] Dronetag BS mounted
- [x] **TOF stack mounted and wired: 9× VL53L1X, 2× PCA9548A muxes, MTF-01** (2026-08-17)
- [ ] **Wire the ESP32-S3 to the mux stack**
- [ ] **Wire the ESP32-S3 to the FC** (UART1 / SERIAL1)
- [ ] **Record the channel → direction map** (which mux, which channel, pointing where) — it exists
  only in the loom right now and `OBSTACLE_DISTANCE` cannot be built without it
- [ ] **Configure the MTF-01** — including the `mav_id`/`SERIALx_OPTIONS` gotcha and the MicoAssistant
  `mav-apm` protocol change, both of which need an FTDI adapter. See [pending configuration](#pending-configuration--esp32-companion-and-mtf-01)
- [ ] **Configure the ESP32 proximity feed** (`PRX1_TYPE = 2`, distinct sysid)
- [ ] Walk the bench validation ladder in order before enabling avoidance
- [ ] `FLOW_ORIENT_YAW` is **independent of** `AHRS_ORIENTATION` — must match flow sensor forward relative to *vehicle*. Validate with slow low Loiter, watch for toilet-bowling.
- [ ] I2C bus loading: 2 muxes + 9 sensors + compass share the bus. Keep runs short, away from ESC phase leads.

### Video (HDZero)
- [x] **80 mm MIPI cable fitted, camera to VTX, VTX to FC** (2026-08-17) — not yet powered
- [ ] `OSD_TYPE` → **5** (MSP DisplayPort); it is currently `1` (MAX7456 analog) and the canvas will
  be blank until changed. `SERIAL2_PROTOCOL = 42` is already correct.
- [ ] Confirm how the **Dronetag BS** is fed now that the VTX has taken the connector — and that the
  rail carries both

---

## Regulatory

- Dronetag BS is a **broadcast module**, not Standard Remote ID. That category requires **visual line of sight at all times**, no exceptions under Part 107. Closes off BVLOS unless a Standard RID path is adopted later.
- **The BS serial number goes on the FAA registration**, not the aircraft's.