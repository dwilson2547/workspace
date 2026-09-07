# CL35 ToF proximity bridge

ESP32-S3 firmware that reads 9× VL53L1X (8 horizontal ring + 1 up-facing) through
two PCA9548A muxes and publishes the obstacle field to ArduPilot.

Spec: [`../../CL35 tof proximity handoff.md`](../../CL35%20tof%20proximity%20handoff.md).
FC-side parameters: [`../../ardupilot_setup.md`](../../ardupilot_setup.md).

## ⚠ The sensor map is not filled in yet

`SENSOR_MAP` in [`src/config.cpp`](src/config.cpp) is a **placeholder**. The real
(mux, channel) → direction mapping exists only in the wiring loom. Until it is
filled in, `SENSOR_MAP_CONFIGURED` stays `false` and the firmware **boots into
scan mode** rather than transmitting a guessed geometry.

## Build

PlatformIO. Note the `pio` on `$PATH` may be the Python 3.14 install, which
PlatformIO refuses to run under — use the 3.12 env:

```bash
~/miniconda3/envs/pio/bin/pio run                 # build
~/miniconda3/envs/pio/bin/pio run -t upload       # flash
~/miniconda3/envs/pio/bin/pio device monitor      # 115200, USB CDC
```

`platformio.ini` pins the Pololu VL53L1X library and pulls the MAVLink v2 headers
from `mavlink/c_library_v2` (ardupilotmega dialect), so a fresh clone needs
nothing installed by hand.

Host tests for the pure logic — status classification and ring-index derivation —
need no board:

```bash
./test/run_host_tests.sh
```

## Bench procedure: producing the sensor map

This is the job that unblocks everything else. **Power the drone** — the sensors
sit on their own 3.3 V rail, and USB alone only feeds the ESP32, so on USB-only
the scan will correctly find nothing.

1. Flash and open the monitor. It enters scan mode automatically.
2. It walks both muxes × 8 channels and lists every live VL53L1X, then prints a
   paste-ready `SENSOR_MAP` skeleton with the bearings blank.
3. It then streams a live distance table, one column per sensor. **Wave a hand at
   one sensor at a time** and note which column moves — that column's `(mux,
   channel)` is that physical direction.
4. Paste the skeleton into `src/config.cpp`, fill in each bearing in degrees
   clockwise from the nose (0/45/90/135/180/225/270/315), change the up-facing
   sensor's row to `SlotRole::Up`, and set `SENSOR_MAP_CONFIGURED = true`.
5. Reflash. It now transmits.

If the ring bearings are not each used exactly once, the firmware refuses to
transmit and says so. That is deliberate: a mis-aimed proximity ring is worse than
no ring, because avoidance will push the craft *toward* the obstacle it thinks it
is dodging.

## Layout

| File | |
|---|---|
| `include/config.h` | pins, timing, geometry, MAVLink identity, sentinels |
| `src/config.cpp` | **the sensor map** — the placeholder to replace |
| `src/geometry.{h,cpp}` | pure logic: status classification, ring-index derivation. Host-testable. |
| `src/mux.{h,cpp}` | PCA9548A discipline, bit-bang bus recovery |
| `src/sensors.{h,cpp}` | re-runnable discovery, poll loop, staleness |
| `src/mavlink_out.{h,cpp}` | `OBSTACLE_DISTANCE`, `DISTANCE_SENSOR`, heartbeat |
| `src/scan.{h,cpp}` | bench scan mode |
| `src/main.cpp` | boot, mode selection, fixed-cadence transmit |

## Behaviour worth knowing before debugging it

- **No sensors is a normal state, not a fault.** With USB connected and the drone
  unpowered, the sensor rail is down. The firmware keeps transmitting at 20 Hz
  with every sector `65535` and retries discovery every second. It never blocks or
  reboots on a missing rail.
- **The ring and the up sensor use different messages.** Only the 8 horizontal
  sensors go in `OBSTACLE_DISTANCE`. The up-facing one is `DISTANCE_SENSOR` with
  `MAV_SENSOR_ROTATION_PITCH_90`, which ArduPilot stores as `_distance_upward`.
- **On an unknown upward reading the firmware sends nothing.** `AP_Proximity_MAV`
  assigns `_distance_upward` with *no* validity check, so a `65535` sentinel would
  read as a 655 m ceiling. Silence is the correct signal — `get_upward_distance()`
  goes false after the 500 ms timeout.
- **Never two mux channels open at once.** Every sensor answers to `0x29`; two
  open channels means two devices on one address and every transaction is corrupt.
  `mux::select()` closes the other mux first and is the only thing that writes a
  mux control register.
- **Status 7 is never valid.** It is aliasing off a reflective surface beyond
  range and reports *short*, sometimes by metres.

## Not yet verified on hardware

Everything below the host tests is unexercised — this was written against the spec
without a board attached. In particular: I2C timing under real bus load, whether
the sensors tolerate `init()` while their neighbours are mid-measurement, the
bit-bang recovery path, and every MAVLink frame as ArduPilot actually parses it.
