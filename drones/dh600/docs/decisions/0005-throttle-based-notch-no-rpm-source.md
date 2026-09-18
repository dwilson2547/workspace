---
kind: decision
status: accepted
date: 2026-09-18T18:46:59-04:00
source: docs/notes/dh600-hover-noise-fundamental-is-56hz-second-harmonic-dominates-roll.md
---

# 0005 — Throttle-scaled harmonic notch at 56 Hz, because the build has no RPM source

## Context

Tuning plan was "ESC notch, then autotune the remaining axes, then roll again." The ESCs are
Hobbywing XRotor 40 A on proprietary firmware: PWM only, no telemetry, no DShot (manufacturer
page; the build log calls them analog). Motors are on the IO MCU main outputs, `MOT_PWM_TYPE=0`.
There is nothing for `INS_HNTCH_MODE=3` to read.

## Options

- ESC telemetry notch (MODE 3). Needs different ESCs and the motors moved to FMU outputs.
  Hardware change; rejected for now.
- In-flight FFT (MODE 4). Locked onto the 3rd harmonic on the X500 and wandered 76–422 Hz.
- **Throttle-scaled notch (MODE 1)** from a measured hover fundamental. The X500 method; the
  hover flight supplies the number the FFT could not find reliably.

## Decision

MODE 1 with the 2026-09-18 measurement:

| param | value | from |
|---|---|---|
| `INS_HNTCH_ENABLE` | 1 | reboot after setting |
| `INS_HNTCH_MODE` | 1 | |
| `INS_HNTCH_REF` | 0.167 | `MOT_THST_HOVER` as learned on the baseline flight |
| `INS_HNTCH_FREQ` | 56 | centre of the 53.6/57.8 Hz motor pair |
| `INS_HNTCH_BW` | 28 | FREQ/2; covers the four-motor spread at each harmonic |
| `INS_HNTCH_ATT` | 40 | |
| `INS_HNTCH_HMNCS` | 7 | harmonic 2 is the dominant roll peak, so 1+2+3 |
| `INS_HNTCH_FM_RAT` | 0.5 | floor of 28 Hz; hover at 0.167 leaves little throttle below |
| `INS_HNTCH_OPTS` | 0 | |

`INS_GYRO_FILTER` stays 20 for the verification flight. Raising it is a separate step after the
notch is proven.

## Accepted 2026-09-18

Verification hover, log `2026-09-18 18-56-27.bin`, 169 s airborne in PosHold at ThO 0.171,
same day, same pack type, same configuration plus the table above.

| metric | baseline | with notch |
|---|---|---|
| roll D-term RMS | 0.0074 | 0.0019 (−74 %) |
| pitch D-term RMS | 0.0079 | 0.0022 (−73 %) |
| roll / pitch D-term peak | 0.0266 / 0.0359 | 0.0070 / 0.0072 |
| notch centre (FTNS) | — | 56.7 Hz, range 55.2–58.4, tracks √(ThO/REF) with r = 0.978, mean error 0.07 Hz |
| 2nd-harmonic band 100–125 Hz, roll, post-filter | 4.1e-5 (LPF only) | < 1e-6 |
| VIBE mean | 5.8 / 8.3 / 7.1 | 7.0 / 7.8 / 7.5, no clips |

Hover learn moved 0.167 → 0.175 during the flight; `INS_HNTCH_REF` stays 0.167 unless a later
flight shows the centre drifting. Next: autotune pitch and yaw with this notch active, then roll
again (`docs/notes/…56hz…` for the baseline numbers).
