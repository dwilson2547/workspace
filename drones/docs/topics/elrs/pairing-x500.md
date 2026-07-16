# ELRS Pairing — X500

_Pending — RP3 wired to Pixhawk 6C TELEM1; **wiring not yet verified** (possible TX/RX swap)._

Receiver setup: [rx-x500-rp3.md](rx-x500-rp3.md). Generic procedure + test ladder:
[ELRS index](README.md).

> ⚠ **Prerequisite:** verify the RP3 → TELEM1 TX/RX wiring before the link test — see the wiring
> callout in [rx-x500-rp3.md](rx-x500-rp3.md). No link with a correct bind phrase almost always
> means TX/RX are swapped.

- **Date paired:** —
- **TX:** RadioMaster TX16S Mark II, internal ELRS 3.3
- **RX:** RadioMaster RP3 ELRS (version TBD — verify ≥ 3.x)
- **Bind method:** shared phrase `dwdrones`

## Tests completed

| # | Test (ladder step) | Result | Notes |
|---|--------------------|--------|-------|
| 1 | Link test | ⬜ | |
| 2 | Channel test (BF/QGC or PX4 RC calibration) | ⬜ | X500 is PX4 — verify in QGroundControl RC calibration, not Betaflight |
| 3 | Modes / flight-mode switch test | ⬜ | |
| 4 | Motor test — **props off** | ⬜ | via QGC actuator/motor test |
| 5 | Failsafe test — **props off** | ⬜ | RC-loss failsafe behaviour in PX4 |
| 6 | Range sanity | ⬜ | |
| — | First flight | ⬜ | |

> Note: the X500 runs **PX4**, not Betaflight — the channel/modes/motor/failsafe checks are done in
> QGroundControl, not the Betaflight Configurator. Same intent, different tool.
