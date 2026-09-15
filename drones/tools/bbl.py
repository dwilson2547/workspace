#!/usr/bin/env python3
"""bbl.py -- Betaflight blackbox analysis for tuning decisions.

Reads .BBL flash dumps directly via orangebox (pure python, no blackbox_decode
build). A full flash dump holds several sessions concatenated; log indices are
1-BASED, and orangebox raises partway through the last session when it runs off
the end of valid data, so every frame loop here is wrapped and keeps what parsed.

Needs the venv:  drones/tools/.venv/bin/python bbl.py <cmd> <file.BBL> [log]

Commands
  inventory <file>              list sessions; flags which contain real flight
  excite    <file> [log]        flight mode, stick travel, setpoint, input sharpness
  noise     <file> [log]        gyro noise vs throttle, RPM tracking, D-term
  step      <file> [log]        step response (overshoot, t63) + direct tracking gain
  battery   <file> [log] [cells] pack internal resistance from throttle punches

Read the numbers with these caveats, all of which have bitten this fleet:

  SAMPLE RATE. Logging is capped at the PID loop rate divided by the blackbox
  denom. At 1kHz the Nyquist limit is 500Hz, and a 4600KV motor on 4S turns
  ~1150Hz flat out -- the fundamental ALIASES and the noise numbers are fiction
  above hover. Set blackbox_sample_rate to 1/2 before any filter work.

  EXCITATION. PID conclusions need real steps. Self-levelling modes cap commanded
  rate (check `excite`: flightModeFlags bit0 is ARM, bit1 ANGLE, bit2 HORIZON),
  and gentle acro flying produces nothing to measure. Sharpness beats amplitude:
  a fast half-stick snap is better data than a slow full-stick sweep.

  CURRENT SENSOR. AIO current sensors are commonly off by ~2x, which makes
  absolute internal-resistance numbers meaningless. Sanity-check against physics
  (hover g/W, per-motor amps) before believing them. RATIOS between packs measured
  on the same aircraft are still valid, because the error cancels.

  DECONVOLUTION. The Wiener step response is regularised, which biases its
  steady-state gain DOWNWARD -- it read 0.54 on an aircraft that tracks at 1.00.
  Trust `step`'s direct regression gain for tracking, and the deconvolution only
  for overshoot and rise-time shape.
"""
import sys
import numpy as np

try:
    from orangebox import Parser
except ImportError:
    sys.exit("needs the venv: drones/tools/.venv/bin/python bbl.py ...")


def load(path, li=1):
    """Return (accessor, headers, nframes). Tolerates a truncated final session."""
    p = Parser.load(path, li)
    names = list(p.field_names)
    idx = {n: k for k, n in enumerate(names)}
    rows = []
    it = p.frames()
    while True:
        try:
            rows.append(next(it).data)
        except StopIteration:
            break
        except Exception:
            break          # orangebox runs off the end of valid flash; keep what we have
    def arr(n):
        k = idx.get(n)
        if k is None:
            return None
        return np.array([(r[k] if isinstance(r[k], (int, float)) else np.nan)
                         for r in rows], float)
    return arr, p.headers, len(rows)


def base(path, li):
    arr, h, n = load(path, li)
    t = arr("time") / 1e6
    fs = 1.0 / np.median(np.diff(t))
    thr = arr("rcCommand[3]")
    return arr, h, n, t - t[0], fs, thr, thr > 1010


def cmd_inventory(path, _li=None):
    i = 1
    while i <= 60:
        try:
            arr, h, n, t, fs, thr, armed = base(path, i)
        except Exception:
            break
        if n == 0:
            break
        gmax = max(np.nanmax(np.abs(arr(f"gyroADC[{a}]"))) for a in range(3))
        mmax = max(np.nanmax(arr(f"motor[{a}]")) for a in range(4))
        kind = "FLIGHT" if (np.nanmax(thr) > 1200 and gmax > 100) else "bench/idle"
        print(f"log {i:2d}: {n:8d} fr  {t[-1]:7.2f}s  {fs:5.0f}Hz  "
              f"thr {np.nanmin(thr):5.0f}-{np.nanmax(thr):5.0f}  "
              f"|gyro|max {gmax:7.1f}  motMax {mmax:5.0f}  -> {kind}")
        i += 1


def cmd_excite(path, li):
    arr, h, n, t, fs, thr, armed = base(path, li)
    print(f"log {li}: {n} fr  {t[-1]:.1f}s  fs {fs:.0f}Hz  Nyquist {fs/2:.0f}Hz  "
          f"armed {armed.mean()*100:.0f}%")
    if fs < 1500:
        print("  WARNING: fs < 1500Hz -- high-throttle noise will alias, see module docstring")
    fm = arr("flightModeFlags")
    if fm is not None:
        u, c = np.unique(fm[armed].astype(int), return_counts=True)
        print("\nFLIGHT MODE (bit0 ARM, bit1 ANGLE, bit2 HORIZON; bare ARM = acro)")
        for v, k in sorted(zip(u, c), key=lambda x: -x[1])[:4]:
            print(f"  flags {v:4d} (0b{v:08b}): {k/armed.sum()*100:5.1f}%")
    print("\nEXCITATION (need fast edges; sharpness matters more than amplitude)")
    for a, ax in enumerate("RPY"):
        sp = np.nan_to_num(arr(f"setpoint[{a}]"))
        rc = np.abs(arr(f"rcCommand[{a}]")[armed])
        d = np.abs(np.gradient(sp, t))[armed]
        edges = np.diff(np.concatenate(([0], (d > 3000).view(np.int8)))).clip(0).sum()
        print(f"  {ax}: max|sp| {np.nanmax(np.abs(sp[armed])):6.0f} deg/s  "
              f"max stick {np.nanmax(rc)/5:4.0f}%  max slew {d.max():7.0f}  "
              f"sharp edges {edges:4d}")
    print("  (a stick-to-stop-and-back in 200ms at 400 deg/s is ~4000 deg/s/s)")
    print("\nTHROTTLE TIME BUDGET")
    dt = 1 / fs
    for lo, hi in [(1000,1200),(1200,1400),(1400,1600),(1600,1800),(1800,2000)]:
        m = armed & (thr >= lo) & (thr < hi)
        if m.sum():
            print(f"  {lo}-{hi}: {m.sum()*dt:6.2f}s ({m.sum()/armed.sum()*100:5.1f}%)")


def quiet_mask(arr, t, armed):
    """Armed samples with no meaningful stick input -- isolates noise from control action."""
    q = armed.copy()
    for a in range(3):
        sp = np.nan_to_num(arr(f"setpoint[{a}]"))
        q &= (np.abs(sp) < 50) & (np.abs(np.gradient(sp, t)) < 500)
    return q


def cmd_noise(path, li):
    from scipy.signal import butter, filtfilt, welch
    arr, h, n, t, fs, thr, armed = base(path, li)
    POLES = 12
    erpm = np.vstack([np.nan_to_num(arr(f"eRPM[{i}]")) for i in range(4)])
    rpm = erpm * 100.0 / (POLES / 2)
    print(f"log {li}: fs {fs:.0f}Hz  Nyquist {fs/2:.0f}Hz")
    print("\nMOTOR FUNDAMENTAL from eRPM (bidirectional DShot)")
    bands = [(1000,1200,"idle "),(1200,1400,"hover"),(1400,1600,"mid  "),(1800,2000,"high ")]
    for lo, hi, lbl in bands:
        m = armed & (thr >= lo) & (thr < hi)
        if m.sum() < 200:
            continue
        f0 = np.nanmean(rpm[:, m]) / 60
        warn = "   <-- ABOVE NYQUIST, ALIASED" if f0 > fs/2 else ""
        print(f"  {lo}-{hi} {lbl}: {f0:6.0f} Hz  (RPM {np.nanmean(rpm[:,m]):7.0f})"
              f"  {m.sum()/fs:5.2f}s{warn}")
    q = quiet_mask(arr, t, armed)
    print(f"\nGYRO NOISE RMS >80Hz, QUIET SAMPLES ONLY ({q.sum()/fs:.1f}s of {armed.sum()/fs:.1f}s)")
    b, a_ = butter(2, 80/(fs/2), 'high')
    for lo, hi, lbl in bands:
        m = q & (thr >= lo) & (thr < hi)
        if m.sum() < 400:
            continue
        o = []
        for ax in range(3):
            g = filtfilt(b, a_, np.nan_to_num(arr(f"gyroADC[{ax}]")))[m]
            gu = filtfilt(b, a_, np.nan_to_num(arr(f"gyroUnfilt[{ax}]")))[m]
            o.append((gu.std(), g.std()))
        print(f"  {lo}-{hi} {lbl}: " +
              "  ".join(f"{c}:{u:5.2f}->{f:5.2f}" for c, (u, f) in zip("RPY", o)) +
              f"   R/P {o[0][0]/o[1][0]:.2f}")
    print("\nD-TERM RMS (quiet). Flat across throttle = filtering adequate;")
    print("rising sharply with throttle = noise feeding the D path.")
    for lo, hi, lbl in bands:
        m = q & (thr >= lo) & (thr < hi)
        if m.sum() < 400:
            continue
        v = [np.nanstd(arr(f"axisD[{a}]")[m]) for a in range(2)]
        print(f"  {lo}-{hi} {lbl}: R {v[0]:7.2f}   P {v[1]:7.2f}")
    mot = np.vstack([arr(f"motor[{i}]") for i in range(4)])
    sat = ((mot > 2000).sum(axis=0) >= 1) & armed
    print(f"\nSATURATION >2000: {sat.sum()/fs:.2f}s ({sat.mean()*100:.2f}%)")


def cmd_step(path, li):
    arr, h, n, t, fs, thr, armed = base(path, li)
    print("TRACKING GAIN -- direct regression, no deconvolution (trust this one)")
    for a, ax in enumerate("RPY"):
        sp = np.nan_to_num(arr(f"setpoint[{a}]")); g = np.nan_to_num(arr(f"gyroADC[{a}]"))
        for lo, lbl in [(50, "all   "), (300, ">300  "), (500, ">500  ")]:
            m = armed & (np.abs(sp) > lo)
            if m.sum() < 200:
                continue
            gain = np.polyfit(sp[m], g[m], 1)[0]
            print(f"  {ax} {lbl}: gain {gain:5.3f}  n={m.sum():6d}  "
                  f"mean|sp| {np.abs(sp[m]).mean():5.0f} -> mean|gyro| {np.abs(g[m]).mean():5.0f}")
    print("  (a slope well under 1.0 while the MEANS agree is a regression artifact:")
    print("   data bunched against the rate ceiling has little spread to fit)")
    N, LAM = 1024, 1e-2
    print(f"\nSTEP RESPONSE -- Wiener deconvolution ({N}-sample windows)")
    for a, ax in enumerate(("ROLL", "PITCH", "YAW")):
        sp = np.nan_to_num(arr(f"setpoint[{a}]"))[armed]
        g = np.nan_to_num(arr(f"gyroADC[{a}]"))[armed]
        steps = []
        for s in range(0, len(sp) - N, N // 2):
            S, G = sp[s:s+N], g[s:s+N]
            if np.abs(S).max() < 100 or np.abs(S).std() < 30:
                continue
            w = np.hanning(N)
            Sf, Gf = np.fft.rfft(S*w), np.fft.rfft(G*w)
            H = Gf*np.conj(Sf)/(np.abs(Sf)**2 + LAM*np.abs(Sf).max()**2)
            st = np.cumsum(np.fft.irfft(H, N))
            if np.isfinite(st).all():
                steps.append(st[:int(0.25*fs)])
        if len(steps) < 5:
            print(f"  {ax:6}: only {len(steps)} usable windows -- fly sharper inputs")
            continue
        st = np.median(np.vstack(steps), axis=0)
        tt = np.arange(len(st))/fs*1000
        ss = np.median(st[int(0.15*fs):])
        if abs(ss) < 1e-6:
            continue
        sn = st/ss
        t63 = tt[np.where(sn >= 0.632)[0][0]] if (sn >= 0.632).any() else float('nan')
        print(f"  {ax:6} ({len(steps):3d} win): overshoot {(sn.max()-1)*100:5.1f}%  "
              f"peak@ {tt[sn.argmax()]:5.1f}ms  t63 {t63:5.1f}ms")
    print("  (overshoot >15-20% = too much P or too little D. IGNORE the steady-state")
    print("   value: regularisation biases it low -- use the regression gain above.)")


def cmd_battery(path, li, cells=4):
    arr, h, n, t, fs, thr, armed = base(path, li)
    vb = arr("vbatLatest")/100.0
    amp = arr("amperageLatest")
    amp = amp/100.0 if np.nanmax(amp) > 200 else amp
    m = (thr > 1700) & armed
    d = np.diff(np.concatenate(([0], m.view(np.int8), [0])))
    starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
    rows = []
    print(f"PACK under load ({cells}S), punches above throttle 1700\n")
    print(f"{'t':>7} {'dur':>6} {'V/cell pre':>11} {'min':>6} {'recovered':>10} {'dI':>7} {'mOhm/cell':>10}")
    for s, e in zip(starts, ends):
        if (e-s)/fs < 0.10:
            continue
        pre = slice(max(0, s-int(0.5*fs)), s); post = slice(e+int(0.5*fs), e+int(1.1*fs))
        if post.stop >= len(vb):
            continue
        vpre, vmin, vpost = np.nanmedian(vb[pre]), np.nanmin(vb[s:e]), np.nanmedian(vb[post])
        di = np.nanmax(amp[s:e]) - np.nanmedian(amp[pre])
        if di < 1:
            continue
        r = (vpre-vmin)/di/cells*1000
        rows.append(r)
        print(f"{t[s]:7.1f} {(e-s)/fs:6.2f} {vpre/cells:11.2f} {vmin/cells:6.2f} "
              f"{vpost/cells:10.2f} {di:7.1f} {r:9.1f}")
    if rows:
        print(f"\napparent IR: {np.median(rows):.1f} mOhm/cell")
        print("Full voltage RECOVERY after a punch means resistive sag, not depleted capacity.")
        print("ABSOLUTE value is only as good as the current sensor (often ~2x out -- check")
        print("hover g/W against ~4-6 for a 3\"). Ratios between packs on the same aircraft ARE")
        print("valid. IR scales inversely with capacity, so normalise before comparing sizes.")


CMDS = {"inventory": cmd_inventory, "excite": cmd_excite, "noise": cmd_noise,
        "step": cmd_step, "battery": cmd_battery}

if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in CMDS:
        sys.exit(__doc__)
    import os
    cmd, path = sys.argv[1], os.path.expanduser(sys.argv[2])
    extra = [int(x) for x in sys.argv[3:]]
    if cmd == "inventory":
        CMDS[cmd](path)
    else:
        CMDS[cmd](path, *(extra or [1]))
