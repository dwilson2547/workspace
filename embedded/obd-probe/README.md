---
tier: experiment
domain: embedded
secondary: [automotive, robotics]
---

# obd-probe

Ask a car's OBD port for its VIN and a few live values (rpm, speed, coolant) from a XIAO ESP32-S3, over USB
serial. A standalone experiment: it exists to find out whether OBD-II requests work on our cars before any of it
goes into the dbc-forge dongle, which never transmits today. Why: a VIN identifies the car with no guessing, and a
real rpm and speed give the DBC checks (`robo-services/can_data/tools/dbc_check.py`) an independent reference.
Design context: `robo-services/docs/plans/2026-11-26-guided-learning-mode.md`.

**Status (2026-11-26): not run on a vehicle yet.** ✅ Host tests pass and the sketch compiles for
`esp32:esp32:XIAO_ESP32S3`. ⚠ Nothing below has been tried on a car or a bench bus.

## Layout

| Path | What |
|---|---|
| `firmware/obd_probe/isotp.h` | ISO-TP framing (single, first, consecutive, flow control), no Arduino dependencies |
| `firmware/obd_probe/obd.h` | OBD-II requests and decoders: VIN, supported PIDs, rpm, speed, coolant |
| `firmware/obd_probe/obd_probe.ino` | the sketch: TWAI at 500 kbit/s, serial commands, JSON-lines output |
| `test/test_obd.cpp` | host tests |

```bash
g++ -std=c++17 -Wall -Wextra -o /tmp/test_obd test/test_obd.cpp && /tmp/test_obd   # from this folder
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3 firmware/obd_probe
```

The tests show the code follows the framing and formulas in the standard (including a 20-byte VIN reply split over
three frames and the sequence number wrapping 15 to 0). They do not show a car behaves the same way.

## Wiring (proposed, confirm before powering)

Same pins as `embedded/can-simulator`, one S3 and one TJA1051 breakout:

| XIAO | GPIO | TJA1051 | Note |
|---|---|---|---|
| D0 | 1 | TXD | CAN TX |
| D4 | 5 | RXD | through a divider: RXD → 10 kΩ → D4, D4 → 22 kΩ → GND (RXD is 5 V logic) |
| 5V | – | VCC | 5 V, not 3.3 V |
| 3V3 | – | VIO | if the breakout has one |
| GND | – | GND | |
| – | – | S | tie to GND (normal mode) |

OBD-II connector: pin 6 → CANH, pin 14 → CANL, pin 4 or 5 → GND. Power the S3 from the laptop over USB.

**No 120 Ω termination on the car side.** The car's bus is already terminated at both ends. Check that the breakout
has no termination jumper or resistor fitted across CANH/CANL; remove or open it if it does.
See `robo-services/docs/hardware/tja1051_breakout.md` (the unmarked breakouts stop receiving with S held high).

## Try it on a car

1. Key on (engine running is fine for rpm and speed). Plug in. The probe boots **listen-only** and prints a
   status line every 5 s. `frames` counting up means it hears the bus. `frames` stuck at 0 with no errors means
   a silent bus (wrong pins, or a car that isn't 500 kbit/s HS-CAN on the OBD port).
2. Send `x` to arm. This reinstalls the driver in normal mode, which can transmit and acknowledge. The probe
   transmits nothing before this.
3. `s` asks which PIDs the car supports (mode 01 and mode 09, PID 0x00). Then `v` for the VIN and `r` for rpm, speed and coolant.
4. `d` returns to listen-only. Unplug when done.

Requests are read-only (modes 01 and 09) to the functional id 0x7DF. Output is JSON lines: `request`, `resp`
(with `vin`, `rpm`, `supported`, a negative response code, ...), `isotp_error`, `done`, `stat`.

## What to expect, and what is unverified

- ⚠ OBD-II request id 0x7DF, reply ids 0x7E8–0x7EF, flow control sent to the ECU's own request id (reply id − 8),
  and the formulas (rpm = (256A+B)/4, speed = A, coolant = A−40) are from the standard as I know it, not
  checked against our cars or a copy of the spec.
- ⚠ Padding is 0x00. Some ECUs may only answer if it is 0x55 or 0xAA.
- ⚠ 11-bit ids only. Some vehicles use the 29-bit variant, which this does not send.
- ⚠ Whether a given car answers mode 09 PID 02 at all, and whether it sits behind a gateway that blocks the OBD
  port, is exactly what this is for.
- A car that gives a VIN here and not on the passive bus is a result, not a failure. A car that gives nothing may
  be pre-CAN (the 2003 Grand Marquis gave no CAN frames at all) or gateway-blocked; record which.

## Results

None yet. Record each car here: year, make, model, what `s` listed, whether `v` and `r` answered, and
anything odd in the `stat` lines.
