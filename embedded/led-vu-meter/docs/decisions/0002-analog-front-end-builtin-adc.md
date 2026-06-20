# 0002 — Passive front-end into the built-in ADC (not PCM1808 / MSGEQ7)

**Status:** accepted · **Date:** 2026-06-14

## Context

Audio source is a **PC headphone output** (stereo, unbalanced, ~1 V RMS max, low source
impedance). Three options were considered for getting audio into the system:

1. Passive bias/summing network → SAMD51 built-in 12-bit ADC.
2. **PCM1808** ($6 I2S 24-bit stereo ADC).
3. **MSGEQ7** 7-band hardware graphic-EQ chip.

## Decision

Use **option 1** — passive AC-coupling + mid-rail bias into the built-in ADC.

## Rationale

- **Quality is already sufficient.** 12-bit @ ~16–22 kHz feeds a meter that collapses to
  ~32 px of vertical resolution per band. 24-bit audio fidelity buys nothing here.
- **Source is the friendly case.** ~1 V RMS biased at 1.65 V fits the 0–3.3 V window with
  headroom; no op-amp/gain needed (see `hardware/analog-front-end.md`).
- **PCM1808 adds integration risk, not value.** I2S input must coexist with Protomatter's
  heavy DMA/timer use; free I2S-capable pads aren't guaranteed; it's clock-slave (needs
  MCLK/BCK/LRCK); and **CircuitPython has no SAMD51 I2S-input support**, which would silently
  force Arduino/C++. Wrong trade for a VU meter. Good choice for a future fidelity-sensitive
  build (recorder, stereo-separation effects).
- **MSGEQ7 fights the goals.** 7 fixed bands/chip vs. the wanted 10–12 custom bands + effects;
  FFT is the cheap part on an M4F anyway.

## Consequences

- One analog pin (A1), one ADC-DMA channel — simplest possible integration.
- No hardware AGC → **software auto-gain** handles quiet playback.
- The stage is swappable later (PCM1808/MAX9814 drop in at the same point) without changing
  firmware structure.
