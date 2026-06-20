---
tier: project
domain: embedded
secondary: [media]
status: design
---

# led-vu-meter

A real-time LED spectrum/VU meter. Audio is split into 10–12 logarithmic frequency
bands by an on-chip FFT and rendered on a 64×32 HUB75 LED matrix, with a library of
swappable visual effects.

## Hardware

| Part | Detail |
|------|--------|
| Controller | **Adafruit Matrix Portal M4** — Microchip **SAMD51** (Cortex-M4F @ 120 MHz, hardware FPU). The onboard ESP32 is only a WiFi co-processor ("AirLift") and is *not* where our code runs. |
| Display | HUB75 RGB LED matrix, **64×32** (2048 px), driven by the M4 via Adafruit **Protomatter**. |
| Audio in | PC **headphone output** (stereo, unbalanced, ~1 V RMS max). |
| Front-end | Passive **summing + AC-coupling + mid-rail bias** network → SAMD51 built-in 12-bit ADC. No op-amp; level is comfortable and software auto-gain handles dynamic range. See [`hardware/analog-front-end.md`](hardware/analog-front-end.md). |

## Signal chain

```
PC headphone out ─► L+R summing / AC-couple / bias to 1.65 V ─► SAMD51 ADC (DMA)
   ─► windowed real FFT (CMSIS-DSP) ─► group bins into 10–12 log bands
   ─► per-band level + smoothing + software auto-gain ─► effect renderer ─► Protomatter ─► 64×32 panel
```

## Status

Working prototype on soldered perfboard. Build order:
1. **Analog front-end** — ✅ built (breadboard → perfboard). See [`hardware/analog-front-end.md`](hardware/analog-front-end.md).
2. Firmware bring-up: Protomatter refresh + ADC-DMA sampling coexist — ✅ proven
   (`firmware/dma_rms`, fs ≈ 13 kHz). See [`docs/design.md`](docs/design.md).
3. FFT → log-band pipeline — ✅ working (`firmware/spectrum`): 12 log bands, landscape
   64×32, manual Up/Down gain, per-band noise floor + peak-hold.
4. **Effects library** — next firmware track.

### Hardware roadmap

- **Custom PCB for the front-end** (next hardware track). The passive divider board is the
  right first KiCad project — simple enough to learn the full flow (schematic → symbols →
  footprints → layout → fab export → order samples) before tackling the more complex race-logger
  boards. Spec + open items in [`hardware/analog-front-end.md`](hardware/analog-front-end.md#pcb-kicad-roadmap).
- **Display tilt** (firmware, minor): bring the low end up / balance bands against music's
  natural HF roll-off, once the board is settled.

## Layout

- `hardware/` — analog front-end schematic, BOM, level budget, bring-up checks.
- `docs/design.md` — architecture, framerate budget, open risks.
- `docs/decisions/` — design decision records.
- `firmware/` — controller code (toolchain TBD, see design doc).
