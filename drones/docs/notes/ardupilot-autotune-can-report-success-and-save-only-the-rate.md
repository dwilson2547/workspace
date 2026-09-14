---
title: ArduPilot autotune can report Success and save only the rate PID, silently dropping angle P and accel max
date: 2026-09-14
tags: ardupilot,autotune,mavlink,tlog,param-save,gotcha
source: drones/x500/docs/notes/x500-hover-noise-fundamental-is-84hz-in-flight-fft-locks-on-.md
---

Seen on X500, Copter 4.7.0, pitch axis, 2026-09-14 (tlog "2026-09-14 16-54-22.tlog").

AUTOTUNE printed the complete result and declared success:

  AutoTune: Pitch complete
  AutoTune: Pitch Rate: P:0.108, I:0.108, D:0.0036
  AutoTune: Pitch Angle P:9.589, Max Accel:105237
  AutoTune: Success
  AutoTune: Saved gains for Pitch

On land+disarm it wrote FOUR params and no others: ATC_RAT_PIT_P, _I, _D, _FF.
ATC_ANG_PIT_P stayed 4.5 and ATC_ACC_P_MAX stayed 1100 -- both stock defaults --
despite being printed one line above 'Success'. The rate PID object saved; the
separate AC_P angle-P save and the accel-max set_and_save did not.

How to tell 'FC never saved it' from 'GCS dump is stale', which look identical in
a .param file: read PARAM_VALUE out of the tlog with drones/tools/tlog_params.py.
Writes are broadcast with param_index=65535; bulk downloads carry a real index.
The proof here is that ATC_RAT_PIT_FF was broadcast at save time with value 0
when it was ALREADY 0 -- so that save path notifies even on unchanged values,
and the absence of an ATC_ANG_PIT_P broadcast is real absence of a write, not a
no-change optimisation. Do not conclude 'Mission Planner cached a stale table'
without checking this; that was the wrong first diagnosis on this exact incident.

Recovery needs no re-flight: the final values are in the MSG/STATUSTEXT stream.
Set them by hand and confirm the 65535 echo comes back. Done here as
ATC_ANG_PIT_P=9.589 and ATC_ACC_P_MAX=105237/100=1052.37 (the Max Accel figure
is cdeg/s^2; params on this firmware are deg/s^2, so divide by 100 -- roll's
105470 -> 1054.7 confirms the scale).

Checking ATC_ANG_*_P against its 4.5 default after every axis is now mandatory:
this is the third distinct way gains have gone missing on this airframe, after
an incomplete tune and a tune lost by leaving AUTOTUNE mode before disarm.
