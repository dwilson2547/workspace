# CL35 ToF → ArduPilot Proximity Bridge — Implementation Handoff

Firmware spec for the ESP32-S3 that reads 9× VL53L1X through two PCA9548A muxes and publishes
`OBSTACLE_DISTANCE` (+ `DISTANCE_SENSOR` for the up-facing unit) to a MicoAir743v2 running ArduPilot.

> **Revision note (2026-09-07).** The first draft of this document assumed a uniform 10-sensor
> horizontal ring. The as-built array is **8 horizontal + 1 up-facing**. Section 5 was rebuilt around
> that; the sysid, serial-port and `AVOID_ENABLE` guidance was reconciled against
> [`ardupilot_setup.md`](ardupilot_setup.md) and [`cl35_config.param`](cl35_config.param). The power
> topology in §1 was confirmed as originally written.

---

## 1. Hardware as built

| Item | Detail |
|---|---|
| MCU | Waveshare ESP32-S3-Zero (ESP32-S3FH4R2, 4MB flash / 2MB PSRAM) |
| MCU power | **Dedicated 5V rail** → series Schottky (1N5819/SS14) → `5V` pad → onboard ME6217C33M5G LDO. The diode is there so USB cannot back-feed the drone rail. |
| I²C | `GP8` = SDA, `GP9` = SCL (matches the existing `firmware/vl53l1x_probe` sketch) |
| I²C pull-ups | 4.7 kΩ each to the **ESP32's** 3V3 (LDO output), not the sensor rail |
| UART to FC | `GP17` = TX (→ FC RX), `GP18` = RX (← FC TX). UART1. |
| Muxes | 2× PCA9548A, assumed `0x70` and `0x71` |
| Sensors | **9× VL53L1X — 8 in the horizontal ring + 1 facing up.** All at default `0x29`, distributed across the two muxes. |
| Sensor power | **Dedicated 3.3V rail**, shared with the muxes, common ground with the ESP32 |
| Downward | **Not part of this array.** The MicoAir MTF-01 provides the down-facing rangefinder on its own UART, direct to the FC. |

### Consequences of the power topology

The ESP32 and the sensors are on independently-derived rails. **The firmware must tolerate the ESP32
running with the sensor rail dead.** This is the normal state whenever USB is plugged in with the
drone unpowered — the diode feeds the ESP32 from USB while the sensor 3.3V rail stays down.

- Do not do one-shot discovery in `setup()` and assume it succeeded.
- Discovery must be re-runnable from the main loop and must converge once the rail comes up.
- Absence of the sensor rail is a normal condition, not a fault. Never block or reboot on it.

`GP43`/`GP44` are UART0 and carry the ROM boot log at 115200 on every reset. Do not use them for the
FC link.

---

## 2. Inputs required before implementation

These are not yet specified and must be supplied by Dan. Do not guess them:

1. **Bearing map** — the body-frame yaw angle (degrees, 0 = nose, clockwise positive) of each of the
   **8 horizontal** sensors, and confirmation that they are a uniform 45° ring rather than clustered.
   Section 5.3 assumes uniform 45°.
2. **Mux/channel map** — which `(mux_addr, channel)` pair each sensor sits on, and **which pair is the
   up-facing one**. `README.md` flags this as recorded only in the wiring loom; it needs writing down
   before firmware can be finished.
3. **PCA9548A address straps** — confirm `0x70`/`0x71` and whether `RESET` is wired to a GPIO or tied
   high.
4. **VL53L1X breakout type** — TOF400C carrier; confirm whether `XSHUT` and `GPIO1` are actually
   broken out and wired, or left floating. Determines whether §3.3 applies.
5. **Which UART the MTF-01 is on.** The ESP32 takes **UART1 / SERIAL1** (already `PROTOCOL = 2`).
   `ardupilot_setup.md` proposes UART6 / SERIAL6 for the MTF-01 but it is currently `-1` and the
   module is already physically connected to *some* header — confirm which, so the two don't collide.
6. **Library choice** — ST ULD (STSW-IMG009) or Pololu `VL53L1X`. The existing probe sketch already
   uses Pololu, which exposes `ranging_data.range_status` and the signal/ambient rates directly.
   Staying on Pololu is the lower-cost path; ULD is smaller but means rewriting known-good code.
7. **Inventory reconciliation** — `inventory.md` records **11** TOF400C fitted and wired; this spec
   uses 9. Confirm whether the other two are spares, unwired, or in use for something else, and
   correct whichever document is wrong.

---

## 3. Bus discipline — the hard constraints

### 3.1 One channel open at a time, globally

All nine sensors answer to `0x29`. If a channel is open on mux A **and** a channel is open on mux B
simultaneously, two sensors will drive the bus on the same address and every transaction is corrupt.
The muxes do not coordinate with each other.

```
select(mux_addr, channel):
    if mux_addr != current_mux and current_mux is not None:
        write_byte(current_mux, 0x00)      # deselect the other mux first
    write_byte(mux_addr, 1 << channel)
    current_mux, current_channel = mux_addr, channel

deselect_all():
    write_byte(0x70, 0x00)
    write_byte(0x71, 0x00)
```

Call `deselect_all()` once at init before touching any sensor, and on any I²C error.

The mux control register is upstream of the switches, so `0x70`/`0x71` remain addressable regardless
of which channel is selected.

### 3.2 Free recovery from a wedged sensor

A VL53L1X that hangs holding its `SDx` low only affects its own downstream segment. Writing `0x00` to
that mux disconnects it and the upstream bus recovers immediately. Use this as the per-sensor
recovery path — no bit-banged 9-clock recovery needed for downstream faults.

Upstream recovery (a mux itself wedging SDA) still needs either the `RESET` pin or a bit-banged
recovery on `GP8`/`GP9`. Implement the bit-bang fallback; it's cheap.

### 3.3 If XSHUT is not wired

Without `XSHUT`, a sensor that stops responding cannot be individually reset — the only cure is
cycling the 3.3V sensor rail. The firmware must mark it permanently `UNKNOWN`, keep polling it at a
slow retry rate, and continue serving the other eight. Never let one dead sensor stall the loop.

---

## 4. Sampling architecture

**Do not** round-robin start/stop each sensor. The mux gates I²C access only; it does not gate sensor
operation. Run all nine in continuous ranging and poll them.

### Init (re-runnable)

For each `(mux, channel)` in the map:
1. `select(mux, channel)`
2. Probe `0x29`. NACK → mark `ABSENT`, continue to next.
3. `VL53L1X_SensorInit()`
4. `SetDistanceMode(LONG)`
5. `SetTimingBudgetInMs(50)`
6. `SetInterMeasurementInMs(60)`
7. `StartRanging()`
8. Mark `ONLINE`

Constraints: inter-measurement period must be ≥ timing budget. `15 ms` is a short-mode-only timing
budget and is invalid in long mode. 50/60 ms gives ~16 Hz per sensor with usable long-mode range;
tune if range or noise is unsatisfactory.

### Poll loop

Iterate the sensor list continuously:
1. `select(mux, channel)`
2. `CheckForDataReady()` — if not ready, move on. Do not block.
3. `GetRangeStatus()`, `GetDistance()`, `ClearInterrupt()`
4. Classify (section 4.1), timestamp, store in the shared sector array.

One full sweep is ~9 short transactions. At 400 kHz this is on the order of a few ms, so the sweep
rate is far above the per-sensor measurement rate. That's intended — each sensor updates at its own
cadence and the sweep just harvests whatever is ready.

Run I²C at 400 kHz. The muxes keep only one branch's capacitance on the bus at a time, so 4.7 kΩ is
fine. If a scope shows lazy rising edges on the upstream segment, drop to 2.2 kΩ.

### 4.1 Range status classification

`RangeStatus` values from `vl53l1_def.h`:

| Status | Name | Classification |
|---|---|---|
| 0 | `RANGE_VALID` | **VALID** — use the distance |
| 6 | `RANGE_VALID_NO_WRAP_CHECK_FAIL` | **VALID** |
| 11 | `RANGE_VALID_MERGED_PULSE` | **VALID** |
| 3 | `RANGE_VALID_MIN_RANGE_CLIPPED` | **VALID**, but clamp to `min_distance` |
| 2 | `SIGNAL_FAIL` | **CLEAR** — nothing returning enough signal |
| 4 | `OUTOFBOUNDS_FAIL` | **CLEAR** — ST documents this as a warning that typically fires with the target near the sensor's max distance |
| 1 | `SIGMA_FAIL` | **UNKNOWN** |
| 5 | `HARDWARE_FAIL` | **UNKNOWN** |
| 7 | `WRAP_TARGET_FAIL` | **UNKNOWN** |
| 8 | `PROCESSING_FAIL` | **UNKNOWN** |
| 14 | `RANGE_INVALID` | **UNKNOWN** |
| — | I²C NACK, no data ready within 3× IMP, sensor `ABSENT` | **UNKNOWN** |

Status 7 deserves emphasis: it is aliasing off a highly reflective surface beyond the sensor's range,
and the reported distance comes back **short** — potentially by meters. It must never be passed
through as a valid range.

Any sensor whose last valid update is older than `3 × inter_measurement_period` (180 ms at the
defaults) degrades to `UNKNOWN` regardless of the last status read.

### 4.2 Optical crosstalk

Because every sensor free-runs, all nine emitters fire asynchronously inside a plastic ducted frame
with reflective surfaces inches away. At 45° spacing with the VL53L1X's ~27° default FoV the ring
sensors should not see each other directly, but near-field bounces off the duct walls can couple.

This is a *measurement* problem, not a bus problem, and it will present as plausible-looking noise
rather than as an error status. If sector readings turn out mutually noisy:

- Narrow the ROI (`SetROI` / `setROISize`) to tighten each sensor's cone — cheapest fix, costs range.
- Only if that fails, fall back to interleaved timing (halve the ring, alternate measurement windows),
  which costs update rate and complicates the poll loop considerably.

Check for this during bench bring-up (acceptance criterion 3) rather than discovering it in flight.

---

## 5. MAVLink output

The array splits across two messages. The 8 horizontal sensors become one `OBSTACLE_DISTANCE`
boundary; the up-facing sensor has no meaningful bearing in that boundary and goes out separately as
`DISTANCE_SENSOR`. **Do not give the up sensor a slot in `distances[]`** — ArduPilot would treat a
ceiling as a horizontal obstacle at whatever yaw you assigned it and brake sideways underneath it.

### 5.1 Message and cadence

Send `OBSTACLE_DISTANCE` (id 330) at **20 Hz**, unconditionally, on a fixed timer. Never skip a frame
because sensors are bad — encode the badness in the payload instead.

`AP_Proximity_MAV` sets `Status::NoData` if no message arrives within `PROXIMITY_MAV_TIMEOUT_MS`
(500 ms). 20 Hz gives 10× margin.

The `OBSTACLE_DISTANCE` handler calls `frontend.boundary.reset()` at the top of every message, so each
frame **fully replaces** the proximity boundary. Every frame must therefore carry a complete picture
of all sectors. There is no accumulation across frames for this message type.

### 5.2 `OBSTACLE_DISTANCE` field values

| Field | Value |
|---|---|
| `time_usec` | `esp_timer_get_time()` (µs since boot) |
| `sensor_type` | `MAV_DISTANCE_SENSOR_LASER` |
| `distances[72]` | see 5.3 |
| `increment` | `0` — forces ArduPilot to use `increment_f` |
| `increment_f` | **`45.0`** (uniform 8-sensor ring) |
| `angle_offset` | `0.0` if sensor index 0 faces the nose; otherwise the bearing of index 0 |
| `min_distance` | `10` (cm) — **must not be 0** |
| `max_distance` | `400` (cm) |
| `frame` | `MAV_FRAME_BODY_FRD` |

ArduPilot computes `total_distances = MIN(360/|increment| + 0.5, 72)`. With `increment_f = 45.0` that
is `(8.0 + 0.5)` truncated to **8**, so it reads exactly `distances[0..7]` and ignores the rest.

### 5.3 Filling `distances[]`

Index `j` corresponds to bearing `j × 45°`, clockwise from `angle_offset`. Map each physical ring
sensor to its index via the bearing map.

| Sensor state | Value written |
|---|---|
| VALID | distance in cm, clamped to `[min_distance, max_distance]` |
| CLEAR | `max_distance + 1` = `401` |
| UNKNOWN | `65535` (`UINT16_MAX`) |
| Indices 8–71 | `65535` |

**Be aware of what ArduPilot actually does with these.** The per-element check is:

```c
const bool range_check = distance_cm == 0 || distance_cm == 65535 ||
                         distance_cm < packet.min_distance || distance_cm > packet.max_distance;
```

Elements failing it are skipped. `401` fails on `> max_distance`, so CLEAR and UNKNOWN both end up as
"no reading for this face" and the face is left reset. The distinction is preserved for spec
compliance, for your own logging, and for any other consumer — but do not expect ArduPilot to behave
differently between the two.

Do not use `0` for the unused tail indices even though MAVLink2 payload truncation would shrink the
frame: `0` is a valid distance meaning "touching the sensor," and it is explicitly rejected anyway.
The bandwidth is not needed (see 5.6).

### 5.4 The up-facing sensor — `DISTANCE_SENSOR`

`AP_Proximity_MAV` also handles `DISTANCE_SENSOR` (id 132), and special-cases the upward orientation:

```c
if (packet.orientation == MAV_SENSOR_ROTATION_PITCH_90) {
    _distance_upward = packet.current_distance * 0.01f;
    _last_upward_update_ms = AP_HAL::millis();
}
```

That value is served by `get_upward_distance()` and consumed by the avoidance layer to limit climb
under a ceiling — which is exactly what this sensor is for indoors.

| Field | Value |
|---|---|
| `time_boot_ms` | `esp_timer_get_time() / 1000` |
| `min_distance` | `10` (cm) |
| `max_distance` | `400` (cm) |
| `current_distance` | VALID → cm clamped to range; CLEAR → `400` |
| `type` | `MAV_DISTANCE_SENSOR_LASER` |
| `id` | any distinct non-zero id |
| `orientation` | `MAV_SENSOR_ROTATION_PITCH_90` |
| `covariance` | `0` (unknown) |

Send at the same 20 Hz as the boundary message.

**On UNKNOWN, send nothing at all.** Note in the code above that the assignment is unconditional —
there is no validity check on this path, so a sentinel like `65535` would be taken literally as a
655 m ceiling. Withholding the message is the correct signal: `get_upward_distance()` returns false
once the reading goes stale past the 500 ms timeout. This is the one place in this spec where
*not* transmitting is the right behaviour.

### 5.5 Heartbeat

Send `HEARTBEAT` at 1 Hz with:
- `type` = `MAV_TYPE_ONBOARD_CONTROLLER` — **not** `MAV_TYPE_GCS`, which would make ArduPilot treat
  the ESP32 as a ground station and tie GCS failsafe to it.
- `autopilot` = `MAV_AUTOPILOT_INVALID`
- **sysid = a third distinct value.** The FC is `1` and the MTF-01 is being moved to `200`; pick
  something else (e.g. `201`). Both peripherals speak MAVLink into this FC on separate UARTs, and
  `ardupilot_setup.md` records sharing a sysid as presenting as intermittent, confusing dropouts
  rather than a clean failure. `OBSTACLE_DISTANCE` itself has no `target_system` and would be
  accepted from any source, so this is about routing and diagnosability, not about the data arriving.
- compid = `MAV_COMP_ID_OBSTACLE_AVOIDANCE`, **not** `1` — compid 1 collides with the autopilot.

Reference these as enum symbols from the generated headers rather than numeric literals.

### 5.6 Serial

Use the generated C headers from `mavlink/c_library_v2`, `ardupilotmega` dialect. Header-only, no
runtime dependency.

Baud: 115200 is sufficient. A MAVLink2 `OBSTACLE_DISTANCE` frame with a full 72-element array is
~167 bytes; at 20 Hz, plus `DISTANCE_SENSOR` and the heartbeat, that's still under 4 kB/s ≈ 35 kbps
against a 115200 budget. Note `SERIAL1_BAUD` is currently **`57`** in `cl35_config.param` and needs
raising to `115`. Use 460800 if you want headroom for `STATUSTEXT` diagnostics.

Serialize MAVLink emission and I²C polling on the same core, or guard the sector array with a mutex if
you split them. Do not build the packet from a half-updated array.

---

## 6. Failure handling summary

| Condition | Behavior |
|---|---|
| Sensor rail unpowered | All 8 sectors `65535`, no `DISTANCE_SENSOR` sent. Keep transmitting the boundary + heartbeat. Retry discovery every 1 s. |
| Single ring sensor NACKs | That sector `65535`. Deselect its channel. Retry that sensor every 1 s. |
| Up sensor NACKs | Stop sending `DISTANCE_SENSOR`. Retry every 1 s. |
| Sensor stale (>3× IMP) | That sector `65535` / up message withheld. Attempt re-init. |
| Mux NACKs | All sectors on that mux `65535`. Retry mux init every 1 s. |
| Upstream I²C wedged | `deselect_all()`, bit-bang recovery on `GP8`/`GP9`, re-run discovery. |
| ESP32 dead | No transmission → ArduPilot times out at 500 ms and reports `NoData`. Correct behavior; no action needed. |

The only legitimate reason to stop transmitting the boundary is total pipeline death, and that happens
for free.

---

## 7. FC-side parameters (for bench test)

The ESP32 is on **UART1 / SERIAL1**. Current values from `cl35_config.param` in brackets.

| Parameter | Value | Currently |
|---|---|---|
| `SERIAL1_PROTOCOL` | `2` (MAVLink2) | `2` — already correct |
| `SERIAL1_BAUD` | `115` | `57` — **needs changing** |
| `PRX1_TYPE` | `2` (MAVLink) | `0` — **needs changing** |
| `PRX1_ORIENT` | `0` if the sensor ring is upright; `1` if inverted (flips the increment sign) | — |
| `PRX1_YAW_CORR` | `0` initially; added to the packet's `angle_offset` | — |
| `AVOID_ENABLE` | `3` (fence + proximity) — only after the proximity display is verified | `3` — already correct |

`AVOID_ENABLE` is a bitmask: `1` = fence, `2` = proximity, `4` = beacon fence. The existing `3` is the
right value for this airframe; **`7` would add beacon fence, and there are no beacons on this craft.**

Verify with Mission Planner's proximity radar view (Ctrl-F → Proximity) before enabling any avoidance.

---

## 8. Acceptance criteria

1. With the drone unpowered and only USB connected, firmware runs, transmits the boundary at 20 Hz,
   and every sector reads `65535`. No crash, no reboot loop.
2. Powering the sensor rail with the ESP32 already running causes discovery to converge within 2 s
   with no reset.
3. On the bench, all 9 sensors read plausible and *stable* values simultaneously — specifically, that
   covering one sensor does not perturb its neighbours (§4.2 crosstalk check).
4. Mission Planner's proximity view shows 8 sectors in the correct angular positions; an obstacle
   placed at a known bearing lights the correct sector.
5. Physically disconnecting one ring sensor blanks exactly one sector; the other seven keep updating.
   Reconnecting it restores that sector within 2 s.
6. A surface held above the craft registers as an upward distance (not as a horizontal sector), and
   removing it makes the reading go stale rather than reporting a false ceiling.
7. A mirror or polished surface at ~4 m does not produce a short reading (status 7 correctly
   suppressed).
8. Killing ESP32 power makes ArduPilot report `PRX1: No Data` within ~500 ms.

---

## 9. References

- `AP_Proximity_MAV.cpp` — `handle_obstacle_distance_msg()`, `handle_distance_sensor_msg()`,
  `PROXIMITY_MAV_TIMEOUT_MS`, the per-element range check, the `PITCH_90` upward special case, and the
  `boundary.reset()` at message start.
  https://github.com/ArduPilot/ardupilot/blob/master/libraries/AP_Proximity/AP_Proximity_MAV.cpp
- MAVLink `OBSTACLE_DISTANCE` field semantics (the sentinel conventions live in the `distances[]`
  field comment): https://mavlink.io/en/messages/common.html#OBSTACLE_DISTANCE
- MAVLink `DISTANCE_SENSOR`: https://mavlink.io/en/messages/common.html#DISTANCE_SENSOR
- VL53L1X `RangeStatus` definitions:
  https://docs.ros.org/en/noetic/api/vl53l1x/html/group__VL53L1__define__RangeStatus__group.html
- ST on status 4 and 7 interpretation:
  https://community.st.com/t5/mems-sensors/what-does-mean-quot-range-status-7-wrapped-target-vl53l1x/td-p/403801
- TI PCA9548A datasheet: https://www.ti.com/lit/ds/symlink/pca9548a.pdf
- Waveshare ESP32-S3-Zero wiki (5V pad accepts 3.7–6V into the LDO):
  https://www.waveshare.com/wiki/ESP32-S3-Zero
- Project context: [`README.md`](README.md), [`ardupilot_setup.md`](ardupilot_setup.md),
  [`inventory.md`](inventory.md), [`cl35_esp32_s3_zero_wiring.png`](cl35_esp32_s3_zero_wiring.png)
