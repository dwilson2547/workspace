# Angel30 — tuning state and blackbox findings

Everything measured on **2026-09-14** across four flights, using `drones/tools/bbl.py`. Method and
its traps: [`../../docs/topics/blackbox-analysis.md`](../../docs/topics/blackbox-analysis.md).

**Bottom line: the stock Betaflight 4.5.2 tune is healthy and no PID change is warranted yet.** One
filter change has been made and is not yet verified on 4S.

## Config as flown

Betaflight **4.5.2**, SPEEDYBEEF405AIOV2. All four PID profiles are empty — PIDs and rates are stock
apart from `thr_mid = 35`. Rates are **Actual** (`rates_type 3`), `rates 67` → full stick ≈ 670 °/s.

⬜ **Planned: raise max rate to ~850 °/s.** Reported 2026-09-18: 670 °/s "feels a bit slow for a
freestyle." Not yet set on the board or flown — see [below](#planned-raise-max-rate-2026-09-18).

| | value | note |
|---|---|---|
| `dshot_bidir` | ON | RPM filtering live, 3 harmonics |
| `dyn_notch_count` / `_q` | 1 / 500 | non-stock (stock 3 / 300) — **justified**, see below |
| `gyro_lpf1_dyn` / `lpf2` | 250–500 / 500 | stock |
| `dterm_lpf1_dyn` / `lpf2` | **100–200 / 200** | **changed** from stock 75–150 / 150 |
| `blackbox_sample_rate` | 1/2 (2 kHz) | changed from 1 kHz — mandatory, see method doc |

## What the data says

**The tune is good.** Unity rate tracking right up to full rate, and low overshoot:

```
tracking gain   roll 1.002 @ 604 °/s    pitch ~1.00 @ 638 °/s    yaw 1.004
step response   roll 5.2% overshoot, t63 36.5ms
                pitch 5.7% overshoot, t63 25.1ms
```

Nothing here says the stock PIDs are wrong. If anything the low overshoot leaves room to raise P for
a sharper feel — but that decision needs a **4S** log, because reduced authority on 3S flatters
overshoot and gains raised on 3S data will overshoot at full voltage.

**RPM filtering works, so `dyn_notch_count = 1` is justified.** eRPM-derived fundamental tracks
215 Hz idle → 322 hover → 443 mid → 629 Hz high, and the measured spectral peak at high throttle
(697 Hz) matches. The decisive evidence that filtering is adequate is that **D-term RMS stays flat
across the throttle range** (roll 6.30 → 6.78 hover to full) while raw gyro noise more than doubles.
Noise feeding the D path is what inadequate filtering looks like, and it isn't happening.

**The D-term filter loosening is unverified.** It was flown only on 3S, where lower RPM moves all
the noise frequencies down. D-term in quiet flight came out comparable to before (roll 5.84 vs 6.30),
so nothing looks wrong — but it is not a fair comparison and should not be treated as settled.

## Planned: raise max rate (2026-09-18)

Stock is 670 °/s at full stick, reported as feeling slow for freestyle. Not yet applied — this
records the target and the reasoning, to be set in Betaflight Configurator's **Rates** tab and
confirmed there before flying.

In **Actual** rates (`rates_type 3`), the `rate` parameter sets max-stick angular velocity
directly and independently of `rc_rate`/center sensitivity: max rate (°/s) = `rate` × 10. That's
why `rates 67` gives ≈670 °/s. Leaving `rc_rate` and `rc_expo` untouched and only raising `rate`
keeps small-stick precision the same and adds authority only at the top of the stick — the right
lever for "slow at full deflection," not "twitchy near center."

**Target: `rate = 85` (roll/pitch/yaw) → ≈850 °/s**, a ~27% increase. Mid-pack for a 3" freestyle
quad — enough to feel noticeably snappier without leaving the tracking margin this airframe has
already shown. Applies to all three axes uniformly, matching how the stock config was flown (no
per-axis split in the "config as flown" table above).

⚠ Provisional pending two things the current data can't settle:

- **Exact CLI field name** for the Actual-mode rate parameter varies across recent Betaflight
  versions (`roll_srate`/`pitch_srate`/`yaw_srate` in some, folded into `rates` in others). Set it
  from the Configurator's Rates tab, which shows the live max-rate number regardless of the
  underlying field name, rather than typing a CLI command from this doc.
- **Not re-verified at the new rate.** The tracking-gain and step-response numbers above (unity
  gain, 5–6% overshoot) were measured up to ~600–640 °/s, comfortably under the current 670 °/s
  ceiling but with less margin under a 850 °/s one. The PID tune itself isn't changing, so nothing
  here suggests a problem — but a quick blackbox log after the change, same method as
  [`blackbox-analysis.md`](../../docs/topics/blackbox-analysis.md), would confirm tracking still
  holds at the new top end before calling it settled.

Once flashed and flown, update the "Config as flown" table above with the new value and move this
section's status from planned to verified.

## Open questions

**Roll runs ~30 % noisier than pitch**, consistently, at every throttle band and in every flight
including before the crash. Cause unknown. A narrow-band test at each motor's own fundamental did
*not* localise it to the chipped M2 prop — the increase was smeared across all four motors, and the
pre-crash baseline was only 2.1 s, too thin to lean on. Settle it with fresh matched props and a
proper quiet baseline.

**Battery is the limit at full throttle, not the motors.** From 1800 to full, current rises 13 % and
RPM rises 1.4 % — the pack has folded. It sags to 3.12 V/cell, below the configured
`vbatmincellvoltage` of 3.30. Voltage fully recovers after each punch, so this is *resistive* sag,
not depleted capacity.

Apparent internal resistance, Tattu standard 650 vs Tattu R-Line 750, same aircraft same day:

```
4S 650 standard (75C)   40.3 mOhm/cell
3S 750 R-Line   (95C)   31.0 mOhm/cell
```

Raw ratio 1.38×; capacity alone accounts for ~1.15×, so R-Line is genuinely **15–20 % better**.
Within one brand's lineup the C ratings are roughly proportional even though they are fiction in
absolute terms.

⚠ **Absolute mΩ figures here are inflated** — the current sensor under-reads by roughly 2×
(hover works out to 10.8 g/W where a 3" realistically does 4–6, and 15.8 A peak across four 1404
4600 KV motors should be 30–45 A). True IR is probably ~20 mΩ/cell, which is **normal** for a 650.
The ratio is still valid; the absolutes are not. **Calibrate `currentMeterScale`** against
charger-returned mAh before quoting any of this — it is also silently wrecking the mAh readout.

Weight budget: measured **225–230 g** AUW against a sub-250 g target, so ~20 g spare. Enough for a
GPS *or* an 850 mAh pack, not both. Since the problem is resistance rather than capacity, an R-Line
650 costs zero grams and keeps the GPS option open.

## Flying the data-collection flight

The tuning answer is only as good as the input. Three flights were wasted learning this:

1. **Acro.** AUX4 high. Self-levelling caps commanded rate ~90 °/s and there is nothing to measure.
2. **Sharp inputs beat big ones.** Stick to the stop and straight back inside ~200 ms; a fast
   half-stick snap is better data than a slow full-stick sweep. Five per axis, single axis at a time,
   throttle steady. Pitch is the one that gets neglected.
3. **Bookend with a steady 15 s hover**, no stick input, for a clean noise baseline at known RPM.
   Without it, quiet samples have to be scavenged from between maneuvers and the baseline is too
   thin to support conclusions.
4. **Throttle sweep** idle → full → idle. Do not chase long full-throttle holds on a 3"; 1.7 s total
   was ample, and 0.65 s is all a normal yard allows.
5. **Erase the flash first** (8 MB ≈ 130 s at 2 kHz) and **fly known-good props**. A straightened
   blade invalidated one flight's noise data.
