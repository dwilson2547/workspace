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

## AUTOTUNE drifts unless entered from PosHold (2026-09-11)

The roll tune above was flown in noticeable wind and wandered badly enough that the
pilot aborted. Cause was not the airframe: AUTOTUNE was entered from Stabilize, so
only the altitude controller ran. The tune window logs 2038 PSCD messages and zero
PSCN/PSCE, while the PosHold segment later in the SAME log does log PSCN/PSCE --
so horizontal position control was genuinely absent, not just unlogged.

ArduPilot holds position during autotune only when the mode is entered from Loiter
or PosHold. Always enter from PosHold. Groundspeed tells the story: 0.13 and 0.08
m/s mean in the two calm hovers against 0.81 mean / 5.32 peak during the tune.

The pilot perceived the twitches favouring one direction. Not real -- roll rate
tracking was symmetric (positive 0.695, negative 0.688 actual/desired), motor
outputs balanced left/right (1491 vs 1491.5us), mean roll 0.07 deg. It was wind
carrying the aircraft during each twitch. The "keeps going after the bump" feel is
the 0.69 tracking ratio: baseline gains only achieve 69% of demanded rate, so it is
mushy and momentum overruns. Resetting to baseline is still correct for tune
quality, but it must be paired with PosHold entry, and ideally calm air.

Separate finding from the same data, worth a bench check: motor averages M1=1450
M2=1460 M3=1523 M4=1532. Roll and pitch pairs balance, but the CW pair runs 72us
harder than the CCW pair -- the FC is continuously countering a yaw torque. Likely
a motor mount out of square, a twisted arm, or a prop mismatch. It consumes yaw
headroom and will matter when yaw is tuned.

Method note: AHRS_WIND_MAX=0 and copters do not populate the EKF wind estimate, so
XKF2 VWN/VWE reading 0.0 means "not estimated", never "no wind". Use GPS groundspeed
against a calm-hover baseline instead.

## Autotune footguns on this airframe (checklist)

Ordered by likelihood of biting, from the 2026-09-11 sessions.

1. Enter AutoTune via the middle detent, deliberately. CORRECTION: an earlier
   version of this note said to set FLTMODE5=16. That is wrong and does nothing.
   Flight mode is a 3-POSITION switch on FLTMODE_CH=6; CH6 only ever reads ~950,
   ~1500 and ~2000us, which land in mode slots 1/4/6. Slots 2, 3 and 5 are
   unreachable, so FLTMODE5 is dead config.
   The middle detent is ALREADY PosHold (FLTMODE4=16), which is what autotune
   wants. The failure was flicking bottom to top fast enough that the middle never
   registered -- the 2026-09-11 log jumps Stabilize straight to AutoTune, and the
   only ~1500us samples in it come from the descent at 296.5s. Stop at the middle,
   confirm PosHold, then go to top. Technique, not configuration.

2. Battery failsafe discards a tune. BATT_FS_LOW_ACT=2 (RTL) at BATT_LOW_VOLT=14.4
   on a 3300mAh 4S. RTL leaves AUTOTUNE mode, which loses the gains exactly like
   switching to PosHold does. Tune flights run ~4min; land deliberately first.

3. Gains save ONLY on land+disarm while still in AUTOTUNE mode.

4. Switching out of AUTOTUNE in flight restores the ORIGINAL gains; switching back
   in restores the tuned ones. So flipping out to "test the new tune" actually
   flies the old gains and tells you nothing.

5. Save a param dump after each successful axis. Roll has now been lost twice by
   two different mechanisms (incomplete tune, then unsaved tune).

6. Yaw autotune will fight the 72us CW/CCW motor split documented above. Square the
   mounts before AUTOTUNE_AXES=4.

7. MOT_HOVER_LEARN=2 keeps moving MOT_THST_HOVER while INS_HNTCH_REF stays pinned
   by hand. Fine at current drift (0.3075 -> 0.3036), but re-set INS_HNTCH_REF if a
   payload changes hover throttle, or the notch tracks the wrong frequency.

## Yaw-axis motor imbalance is longstanding, not new (2026-09-11)

Present in every flight examined, not introduced by any of the notch or tune work:

  flight                     M1(FR,CCW) M2(RL,CCW) M3(FL,CW) M4(RR,CW)  yaw split
  hover 1 (FFT notch)           1439       1470      1512      1523      +63us
  hover 2 (throttle notch)      1457       1478      1523      1539      +64us
  autotune flight               1450       1460      1523      1532      +73us

Roll split -10/-3/-1us and pitch split -21/-19/-9us, i.e. laterally and
longitudinally the aircraft is well balanced. The imbalance is purely rotational:
the CW pair runs ~70us harder than the CCW pair to hold a fixed yaw torque, about
8% of usable output range (MOT_SPIN_MIN 0.06 to MOT_SPIN_MAX 0.95) spent on trim.

Not flight-limiting on its own -- stable hover, VIBE ~7, zero clips, zero ERR --
but it reduces yaw headroom, will saturate sooner under aggressive yaw, and should
be fixed before AUTOTUNE_AXES=4.

CORRECTION: an earlier version of this note named a rotated arm tube as the most
likely cause. X500 arms are pinned through the tube and cannot rotate in the clamp,
so that is ruled out.

It is a genuine torque, not a PWM or ESC-calibration artifact. Yaw PID I-term sits
steady and non-zero in all three flights (-0.0575, -0.0561, -0.0708), i.e. 11-14%
of ATC_RAT_YAW_IMAX held continuously and never unwinding. An ESC or motor response
mismatch would leave the yaw loop balanced with I near zero.

Cause not yet identified. Splitting the autotune flight by throttle gives +74us at
ThO 0.25-0.30 and +72us at 0.30-0.35, which looks flat -- but every flight so far is
a steady hover spanning only ~0.10 of throttle, far too narrow to test whether the
torque scales with RPM^2 (prop/aero) or is fixed (geometry). Do not read a cause
out of that number.

Cheapest discriminating test: swap the two CW props with each other and re-fly the
same hover. Split unchanged means it is not an individual prop, pointing at the CW
set as a whole or at motor mount geometry; split changes means one specific prop.
Swapping all four props at once is more direct if a spare set exists. On the bench,
sight each motor for cant in the horizontal plane, and hand-spin each with props off
to find a dragging bearing -- both produce this signature with tube rotation ruled
out.

Analysis-process note: this was visible in the first two hover logs and was missed
because only VIBE was checked. Low vibration says nothing about static motor trim
-- check the RCOU per-motor means and the three pair splits as a separate step.

## Yaw torque points at a dragging CCW motor; M2 (rear left) is the suspect

Pilot independently observed the rear-left motor looking weak on spin-up. That
matches the yaw signature rather than contradicting it.

ArduPilot QUAD/X puts M1 (front right) and M2 (rear left) as the CCW diagonal, M3
(front left) and M4 (rear right) as CW. A CCW motor with excess drag needs more
torque to hold RPM, so the frame feels excess CW reaction, and the FC cancels it by
raising the CW props. Observed compensation is exactly that: M3/M4 up +63/+64/+73us
across the three flights, with a steady non-zero yaw I-term confirming real torque.
So the signature identifies "a CCW motor is dragging", and the CCW motors are M1
and M2.

It is a TORQUE fault, not a thrust fault. If M2 were simply down on thrust it would
need more PWM than M1 beyond the aft-CG offset. Comparing within each rotation pair
(equal values mean pure CG):

  flight      CCW (M2-M1)   CW (M4-M3)   M2 excess
  hover 1        +30           +11          19us
  hover 2        +22           +16           6us
  autotune       +10            +9           1us

Inconsistent and trending to zero. Takeoff excursions agree -- all three flights
pitch nose-DOWN, where a weak rear-left corner would drop and pitch nose-UP with
roll left. A dragging bearing or marginal ESC fits: worst at spin-up where static
friction and cogging dominate, nearly invisible at hover RPM, but costing extra
torque continuously.

Decisive test, cheap: swap M2's ESC with a neighbour's (or swap the three motor
leads at the ESC). Fault following the ESC means ESC; staying with the motor means
motor. Do a props-off hand-spin of all four first, and check M2's bullets and
solder joints for a high-resistance phase.

Constraint: no per-motor RPM is available to settle this from logs. MOT_PWM_TYPE=0
with no ESC telemetry, and per info.txt the motors are wired to the I/O board while
DShot needs FMU outputs -- so bidirectional DShot is a rewire, not a parameter
change. It would also unlock an RPM-driven notch.

Hand-spin done 2026-09-11: all four motors feel about the same by hand, props off.
No obvious bearing drag on M2. That weakens the bearing theory and promotes the ESC
and the phase connections, so the ESC swap is now the leading test rather than the
fallback. Note a marginal ESC or a high-resistance joint would not necessarily be
detectable by hand -- this rules out gross bearing drag, nothing more.
