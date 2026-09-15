# Betaflight blackbox analysis

Reading `.BBL` flash dumps to make tuning decisions, with the traps that make the numbers lie.
Tool: [`../../tools/bbl.py`](../../tools/bbl.py). Worked example:
[Angel30 tuning](../../freestyle-3in/docs/tuning.md).

Related: [param files](param-files.md) · [Mission Planner on Linux](mission-planner-linux.md)

Written **2026-09-14** from the Angel30 tuning campaign, where four flights were needed because the
first three each hit one of the traps below.

---

## 1. Setup

```bash
drones/tools/.venv/bin/python drones/tools/bbl.py inventory <file.BBL>
drones/tools/.venv/bin/python drones/tools/bbl.py excite   <file.BBL> [log]
drones/tools/.venv/bin/python drones/tools/bbl.py noise    <file.BBL> [log]
drones/tools/.venv/bin/python drones/tools/bbl.py step     <file.BBL> [log]
drones/tools/.venv/bin/python drones/tools/bbl.py battery  <file.BBL> [log] [cells]
```

The venv holds numpy/scipy/matplotlib/**orangebox**. orangebox is a pure-python BBL parser, so no
`blackbox_decode` build is needed and there is no reason to export CSV by hand from Blackbox
Explorer. Two quirks: **log indices are 1-based**, and orangebox raises partway through the final
session when it runs off the end of valid flash — every frame loop must be wrapped and keep what
parsed. `pip install orangebox` alongside other packages fails on a broken entry point; install it
on its own.

Always run `inventory` first. A full flash dump is several sessions concatenated, and bench/idle
sessions look like flights until you check throttle and gyro.

## 2. Sample rate — get this wrong and the noise numbers are fiction

Logging runs at the PID loop rate divided by the blackbox denominator, and **Nyquist is half that.**
A 4600 KV motor on 4S turns ~1150 Hz flat out. At the 1 kHz default, everything above hover
**aliases**, and you cannot see the frequencies you are trying to filter.

Set `blackbox_sample_rate` to **1/2** before any filter work. Cost is flash: 8 MB ≈ 130 s at 2 kHz,
so erase first and fly deliberately. `noise` flags bands whose fundamental exceeds Nyquist.

## 3. Excitation — PID conclusions need real steps

Run `excite` before trusting anything from `step`.

- **`flightModeFlags` bit 0 is ARM, bit 1 ANGLE, bit 2 HORIZON.** Bare `1` is acro. Self-levelling
  caps commanded rate (~90 °/s observed) and leaves nothing to measure, however hard it felt.
- **Sharpness beats amplitude.** A stick-to-stop-and-back in 200 ms at 400 °/s is ~4000 °/s/s of
  slew; `excite` counts edges above 3000. A fast half-stick snap is better data than a slow
  full-stick sweep. In the failed flight, roll already had 25 sharp edges and was usable — **pitch
  had 3**, and that was the actual gap. Check per axis rather than judging the flight as a whole.

## 4. Noise — measure it in quiet air

`noise` restricts to **quiet samples** (no meaningful stick input) before computing gyro RMS, because
D-term and gyro activity during maneuvers is legitimate control action, not noise. Without that
filter an aggressive flight looks like a filtering problem.

**The metric that matters is whether D-term RMS stays flat across throttle.** Flat = filtering is
adequate and there is headroom to loosen. Rising sharply with throttle = noise is feeding the D path.
Raw gyro noise rising with throttle is expected and is not by itself a problem.

Motor fundamentals come from **eRPM** (bidirectional DShot), so the RPM filter's target frequency is
known exactly rather than inferred from a spectrum — no `debug_mode` change needed.

## 5. Battery — recovery separates resistance from capacity

`battery` finds throttle punches and measures the voltage dip against the current step.

**If voltage fully recovers within a second of the punch, the sag is resistive, not depleted
capacity.** That distinction decides whether a bigger pack helps (capacity) or a better one does
(resistance).

⚠ **The absolute mΩ figure is only as good as the current sensor, and AIO sensors are commonly
~2× out.** Sanity-check against physics before believing it: hover efficiency should be ~4–6 g/W for
a 3" (10+ g/W means the sensor under-reads), and a 1404 4600 KV on 4S pulls 8–12 A per motor flat out.
Calibrate `currentMeterScale` against charger-returned mAh.

**Ratios between packs measured on the same aircraft remain valid** — the sensor error cancels.
Normalise for capacity first, since IR scales inversely with it.

## 6. Step response — trust the regression, not the deconvolution

`step` prints both, deliberately.

The Wiener deconvolution is **regularised, which biases its steady-state gain downward** — it read
0.54 on an aircraft that tracks at 1.00, which would have been read as a serious tracking deficit.
Use it for **overshoot and rise-time shape only**.

Use the **direct regression gain** for tracking. One artifact to recognise there: a slope well under
1.0 *while the means agree* means the data is bunched against the rate ceiling with little spread to
fit — not a real deficit. Compare `mean|sp|` against `mean|gyro|` to tell them apart.

## 7. Confounds to control

Change one thing per flight, and note what you could not control:

- **Battery chemistry/voltage.** A 3S flight is not comparable to 4S — every noise frequency moves.
- **Flying intensity.** Aggressive flying raises D-term regardless of filters. Use quiet samples.
- **Prop condition.** A bent-and-straightened blade invalidates a noise baseline.
- **Pack state of charge** shifts RPM at a given throttle command. Compare at matched RPM (from
  eRPM) rather than matched throttle when it matters.
