# 0003 — ELRS CRSF on TELEM1; HM30 and gimbal FC ports left open

**Status:** accepted · **Date:** 2026-09-17 · verified against `dh600.param` and the bench

## Context

The aircraft was wired with the RP3 on TELEM1, not the GPS2 of
[0002](0002-elrs-direct-crsf-on-gps2.md). Commit `f78e308` corrected the README to as-built. This
records the decision that correction implies.

## Decision

| Port | `SERIALx` | Use | Status |
|------|-----------|-----|--------|
| TELEM1 (UART7) | `SERIAL1` | RP3 ELRS, CRSF. `SERIAL1_PROTOCOL=23`, `BRD_SER1_RTSCTS=0` | ✅ |
| TELEM2 (UART5) | `SERIAL2` | SiK 915 MHz, MAVLink | ✅ |
| GPS1 (USART1) | `SERIAL3` | GPS + compass | ✅ |
| TELEM3 (USART2) | `SERIAL5` | free (`SERIAL5_PROTOCOL=-1`) | ⬜ |
| GPS2 (UART8) | `SERIAL4` | free | ⬜ |

Channel map is the fleet standard: `FLTMODE_CH=6`, `RC5_OPTION=153`, `RC2_REVERSED=1`
(`drones/docs/topics/ardupilot-build-standard.md`). `RC6_OPTION` through `RC9_OPTION` are 0.

## Rejected

- **RC6/RC7 for mount pitch/yaw** (from 0002). RC6 is the flight-mode channel. Mount channels
  will be RC7/RC8 or higher, chosen when the A8 mini is fitted.

## Open

- **HM30 MAVLink port.** TELEM1 was the flow-control port and ELRS has it. UART8 has no RTS/CTS
  pins. Whether HM30 telemetry needs flow control is ⚠ unverified. Candidates are TELEM3 and
  GPS2; the HM30 is not wired to the FC and not bound.
- **Gimbal port.** A8 mini not fitted. Takes whichever of TELEM3/GPS2 the HM30 does not.

## Consequences

- `BRD_SER1_RTSCTS=0` is mandatory. The default of 2 (auto) can kill a CRSF link on TELEM1.
- Both spare UARTs are spoken for once HM30 and gimbal land on the FC. Only RC IN remains.
