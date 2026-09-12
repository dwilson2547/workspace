---
title: X500 hover noise fundamental is 84Hz; in-flight FFT locks on the 3rd harmonic
date: 2026-09-11
tags: ardupilot,harmonic-notch,fft,log-analysis,vibration
---

Measured from the 2026-09-11 verification hover (log 2026-09-11 19-42-03.bin, 158s at 0.302 throttle).

With INS_HNTCH_MODE=4 the notch centre averaged 246Hz and ranged 76-422Hz, spending 0.1% of the time near the fundamental. ArduPilot's own harmonic fit reported the locked peak as the 3rd harmonic (FTN1 FHX h3=95%, FHY h3=87%). PkAvg divided by the detected harmonic number gives a tight unimodal distribution centred on 84.2Hz -- that is the true hover fundamental for 2216 KV920 + 1045 on 4S at this weight.

Method worth reusing: do not read FTN1 PkAvg as the fundamental. Divide it by FHX/FHY (the detected harmonic index) before believing it. A wide BwAvg (86Hz here) and a peak wandering across most of MINHZ..MAXHZ are the signature of a harmonic lock rather than a fundamental lock.

Column offsets bite here: FTN1 is TimeUS,PkAvg,BwAvg,SnX,SnY,SnZ,FtX,FtY,FtZ,FHX,FHY,FHZ,Tc and FTN2 is TimeUS,Id,PkX,PkY,PkZ,BwX,BwY,BwZ,SnX,SnY,SnZ,EnX,EnY,EnZ. Off-by-one lands you on Tc (a microsecond cycle time) and produces nonsense harmonic numbers in the hundreds.

Vibration was healthy throughout (VIBE mean 7.1-7.6, peaks <19, zero clips), so a bad FFT lock here is a configuration symptom, not a mechanical one. Z-axis SNR averaged 23.7 against FFT_SNR_REF=25 and cleared threshold only 31% of the time; X and Y were at 100%.

Conclusion for this airframe: with no RPM source, throttle-based scaling (MODE=1, FREQ=84, REF=MOT_THST_HOVER) beats in-flight FFT, because the hover flight supplies the number the FFT could not find reliably.

## Verified 2026-09-11 (log 2026-09-11 20-03-18.bin)

Throttle-based notch flown: MODE=1, FREQ=84, REF=0.31, HMNCS=7, FM_RAT=0.5, BW=40.
157.7s hover at 0.303 throttle, directly comparable to the 157.9s FFT-mode flight.

Notch centre settled at 83.0Hz with r=0.997 against throttle -- proper scaling,
versus 246Hz wandering 76-422Hz under MODE=4. Notches land at 83/166/249Hz, so
the 3rd-harmonic energy that MODE=4 had been chasing is now covered deliberately.

Effect on the D term, which is the point of the exercise:

  roll  D-term RMS  0.0054 -> 0.0033  (-39%)
  pitch D-term RMS  0.0034 -> 0.0024  (-29%)
  VIBE mean         7.2/7.6/7.1 -> 6.8/6.8/6.8
  VIBE peak         13.6/15.5/18.8 -> 12.3/12.8/16.1
  clips 0, ERR 0 in both

Peak D-term rose slightly (roll 0.0178 -> 0.0231). Single-sample transient across
two flights with uncontrolled air and stick input; RMS is the metric that matters.

FFT left enabled for logging independently put the fundamental at 87.4Hz this
flight against 84.2Hz previously, both with FHX h3~90%. Mid-80s either way, well
inside the 40Hz bandwidth, so FREQ=84 stands.

## Roll autotune, clean run 2026-09-11 (log 2026-09-11 20-16-23.bin)

AUTOTUNE_AXES=1 from a reset baseline with the verified notch active. Reached
"Roll complete" / "Success" at 282.3s:

  Roll Rate: P:0.108, I:0.108, D:0.0036
  Roll Angle P:10.068, Max Accel:105470   (= ATC_ACC_R_MAX 1054.7)

ANG_RLL_P came out at 10.068 against 10.06836 from the earlier noise-contaminated
tune -- five-figure agreement across two runs with very different D-term noise.
That value is a real property of the airframe, not a tuning artifact, and the
roll/pitch angle-P asymmetry is simply that pitch has never been tuned.

Rate P keeps falling (0.135 default -> 0.1197 noisy -> 0.108 clean) and D will not
move off 0.0036 even with 39% less D-term noise. Consistent with AUTOTUNE_AGGR at
0.075; worth trying 0.1 if a crisper tune is wanted.

GOTCHA that cost this flight: gains are only committed if you land and disarm
while STILL in AUTOTUNE mode. Mode went AutoTune -> PosHold at 296.5s -> Stabilize
-> disarm, so the originals were restored and nothing was saved. The only roll-gain
PARM writes in the whole log are the baseline values at 51.9s. Recoverable without
re-flying, because the final values are printed in the MSG stream -- read them out
and set them by hand.

Also seen: the FFT auto-saves learned hover values on disarm, and with its
3rd-harmonic lock it wrote FFT_THR_REF=0.0118, FFT_FREQ_HOVER=252, FFT_BW_HOVER=87.
Harmless under INS_HNTCH_MODE=1, which reads INS_HNTCH_REF instead, but these are
junk and must not be trusted if FFT mode is ever re-enabled.
