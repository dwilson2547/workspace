---
title: Cross-check a derived flight-log metric against a direct measurement before acting on it
date: 2026-09-14
tags: blackbox,betaflight,measurement,methodology,gotcha
source: drones/docs/topics/blackbox-analysis.md
---

Two near-misses in the Angel30 blackbox campaign, 2026-09-14, both from trusting a processed
number that had a systematic bias baked in.

1. Wiener deconvolution step response reported steady-state gain 0.54, i.e. the quad achieving
   only 54% of commanded rate -- which reads as a serious tracking deficit worth raising gains
   over. Direct regression of gyro on setpoint over the same samples gave 1.002 at 604 deg/s.
   The deconvolution is regularised and the regularisation biases steady-state DOWNWARD. Use it
   for overshoot and rise-time shape; never for gain.

2. Pack internal resistance computed as dV/dI came out 40 mOhm/cell, which reads as a worn-out
   battery. But dI comes from the FC current sensor, and AIO sensors are commonly ~2x out. The
   physics check: hover worked out to 10.8 g/W where a 3" realistically does 4-6, and 15.8A peak
   across four 1404 4600KV motors should be 30-45A. True IR was probably ~20 mOhm/cell, i.e.
   normal. The pack was brand new and the 'tired pack' conclusion would have been wrong.

The pattern in both: a metric that is a RATIO or a DECONVOLUTION inherits the error of whatever
sits in its denominator or its regulariser, and that error is systematic rather than noisy, so
more data does not reveal it. Averaging looks stable and stays wrong.

What actually catches it:
- compute the same quantity a second way, by the most direct route available
- sanity-check against physics with an independent unit (g/W, amps per motor, RPM vs KV x volts)
- prefer RATIOS between measurements taken on the same hardware, where the systematic error
  cancels -- comparing two packs on one aircraft stayed valid even with the sensor 2x out

Applies well beyond Betaflight. The same shape appeared on the X500 the same day: a saved .param
dump disagreed with the flight controller, and only reading PARAM_VALUE off the tlog -- the direct
route -- showed which was lying. See [[ardupilot-autotune-can-report-success-and-save-only-the-rate]].
