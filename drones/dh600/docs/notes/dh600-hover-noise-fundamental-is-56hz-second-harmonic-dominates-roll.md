---
title: DH600 hover noise fundamental is ~56 Hz; the 2nd harmonic at ~116 Hz dominates the roll gyro
date: 2026-09-18
tags: ardupilot,harmonic-notch,fft,log-analysis,vibration,dh600
source: ~/.local/share/Mission Planner/logs/QUADROTOR/1/2026-09-18 18-32-42.bin
---

Measured from the 2026-09-18 baseline hover (log `2026-09-18 18-32-42.bin`, 172 s of PosHold at
ThO 0.164, 2.5–2.8 m, 23.6 V, 12.8 A). Raw gyro logged with `INS_RAW_LOG_OPT=9`, no notch,
`INS_GYRO_FILTER=20`. Welch PSD, 8192-point, on the primary gyro pre-filter stream (GYR I=0;
I=2 is the post-filter copy on this two-IMU board).

Motor fundamental is a pair of peaks at **53.6 and 57.8 Hz** on all three axes: four motors at
slightly different speeds, matching RCOU 1400/1414/1413/1433 µs. **The 2nd harmonic cluster at
108–121 Hz carries six times the fundamental's energy on roll** (band 80–100 vs 38–52 Hz in the
first pass; 116 Hz is the single largest peak on X at 4.8e-2 against 8e-3 at the fundamental).
3rd harmonic at 169 Hz is minor. Any notch here must include harmonic 2.

Sample-rate trap: `SampleUS` deltas are batched (5th percentile 18 µs, median 619 µs), so a
median-delta rate estimate gives 1616 Hz and scales every peak by 0.8. Use count over span, which
gives 2014 Hz and agrees with `IMU.GHz`. 13 gaps over 2.5× median in 172 s, max 4.9 ms: the H7
kept up.

Other baselines from the same window: VIBE 5.8/8.3/7.1 mean, peaks under 18, no clips. D-term RMS
roll 0.0074, pitch 0.0079 (compare after the notch flight). Hover learn moved 0.186 → 0.167.

Answers the min-throttle question of 2026-09-18: hover RCOU sits at 1400–1433 µs against a
`MOT_SPIN_MIN` floor of 1180 µs, lowest sample 1338 µs. `MOT_THST_HOVER` is thrust demand
before the expo curve, not output; there is 220 µs of descent authority below hover and the floor
stays where it is.

## Verified 2026-09-18 (log `2026-09-18 18-56-27.bin`)

Notch flown per decision 0005 (MODE 1, FREQ 56, BW 28, HMNCS 7, REF 0.167, FM_RAT 0.5). 169 s
airborne at ThO 0.171. Notch centre averaged 56.7 Hz and tracked √(throttle/REF) with r = 0.978
and 0.07 Hz mean error, which is the signature of correct throttle scaling. Roll D-term RMS
0.0074 → 0.0019, pitch 0.0079 → 0.0022; D peaks down four to five times. The 116 Hz roll peak,
4.1e-5 after the 20 Hz low-pass alone, is below 1e-6 with the notch. VIBE unchanged, no clips.

Window trap: the log ends in PosHold on the ground, so a window to end-of-log includes the landing
and lands D-term RMS at zero for those seconds. Gate the window on Alt > 1 m and ThO > 0.05
before comparing; the −73 % held either way but the peaks did not.

## Pitch autotune with the notch active (2026-09-18 19:15, from the GCS message stream)

    AutoTune: Pitch Angle P:7.155, Max Accel:57731
    AutoTune: Pitch Rate: P:0.097, I:0.097, D:0.0044

Whole axis in 2–3 minutes against roughly ten per axis on the X500 and on the DH600 roll tune
two days earlier, both flown without a notch. Log not yet analysed; values as printed. Yaw next.

## Yaw autotune with the notch active (2026-09-18, from the param dump after landing)

    ATC_RAT_YAW_P 0.272  I 0.027  D 0  FLTE 1 (was 2.5)
    ATC_ANG_YAW_P 3.106  ATC_ACC_Y_MAX 183

Both tunes wrote angle P and accel max as well as the rate PID, so the save-only-the-rate
failure of the X500 did not recur. Roll still carries the pre-notch tune (rate P 0.058,
D 0.0023, angle P 6.18) and is next. Flight logs for the two autotune flights are still on the
SD card as of this entry.

## Roll autotune with the notch active (2026-09-18 19:32)

    AutoTune: Roll Angle P:8.086, Max Accel:60244
    AutoTune: Roll Rate: P:0.075, I:0.075, D:0.0032

Against the un-notched roll tune of two days earlier: rate P 0.058 → 0.076, D 0.0023 → 0.0033,
angle P 6.18 → 8.09. Every gain rose once the D path was clean, the same direction the X500
showed when its notch went in. All three axes now tuned under the same filter configuration.
Final set: roll 0.076 / 0.0033 / 8.09, pitch 0.097 / 0.0045 / 7.16, yaw 0.272 / 0 / 3.11
(rate P / rate D / angle P). Hover learn 0.183.
