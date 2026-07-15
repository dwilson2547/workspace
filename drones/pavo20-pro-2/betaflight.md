# Betaflight Config — Pavo20 Pro II

Baseline: factory BNF flash — target `BETAFPVF405`, Betaflight 4.5.3, BetaFPV stock tune. **PIDs untouched** (stock tune is good; don't tune until flying skill stops being the variable).

Related: [Pairing index & testing](../docs/topics/elrs/README.md) · [TX16S setup](../docs/topics/elrs/radio-tx16s.md) · [RX setup](../docs/topics/elrs/rx-pavo20-pro-ii.md)

## Changes made

### Modes tab
| Mode | Channel | Range | Notes |
|---|---|---|---|
| ARM | AUX1 | 1700–2100 | arm = high; `ARM (DISABLED)` in red over USB is normal (MSP block) |
| ANGLE | AUX2 | 900–1300 | switch low position |
| HORIZON | AUX2 | 1300–1700 | switch middle; effectively unused |

AUX2 high (1700+) = no mode active = **acro**. Physical switch map lives in the [TX doc](../docs/topics/elrs/radio-tx16s.md); verify with the Receiver-tab wiggle test after any radio change.

### Throttle feel (PID Tuning tab → Rates)
- **Throttle MID: 0.3** — centers stick resolution on the actual hover point (~25–30% on 3S)
- **Throttle EXPO: 0.3** — flattens the curve around hover; bump to 0.4 if still twitchy, 0.2 if muddy
- Mirror these (and rates) into VelociDrone so sim time transfers.

### Accelerometer calibration
Setup tab → Calibrate Accelerometer, quad on a **verified-level** surface (bubble level / phone inclinometer — the cal defines "level" as whatever it's sitting on). Redo if angle mode drifts consistently in one direction.

## To verify / outstanding

- [ ] **Select the O4 (non-Pro) PID profile via OSD** — I run the **standard O4 Air Unit**, not the Pro. The quad ships with a PID profile for each (they differ because the Pro is heavier). The current config dump is on the **wrong one** — `profile 0` is `profile_name = O4 Pro`. Switch to the standard-O4 profile (the Pro tune flies vague/hot on the lighter O4). OSD menu: disarmed, throttle mid + yaw left + pitch up.
- [ ] Re-run accel cal on a checked-level surface (first attempt was on an unverified surface and made drift worse).
- [ ] Capture `diff all` from CLI into the repo after the above — this file describes intent; the diff is the restore point.

## Deliberately not changed

- PIDs / filters — stock BetaFPV tune
- LED strip — not installed (weight, no LOS-distance need yet)
- Motor Output Limit — left at 100%; option exists (Motors tab, e.g. 80%) if a power cap ever helps training
- Failsafe — stock (drop); verified by radio-off test, see [test ladder](../docs/topics/elrs/README.md)