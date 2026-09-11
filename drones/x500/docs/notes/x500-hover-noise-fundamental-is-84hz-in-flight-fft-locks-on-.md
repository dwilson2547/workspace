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
