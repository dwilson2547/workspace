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
