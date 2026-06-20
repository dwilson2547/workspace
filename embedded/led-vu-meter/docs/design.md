# Design notes

## Architecture

```
ADC (DMA, ~16–22 kHz) ─► ring buffer of int16 samples
   │
   ├─ window (Hann) ─► real FFT, 256 or 512 pt (CMSIS-DSP rfft)
   │      └─ magnitude per bin
   │
   ├─ group bins → 10–12 LOG-spaced bands (octave-ish), e.g. ~40 Hz … ~10 kHz
   │      - log spacing matters: linear bands cram all the action into low bins
   │      - precompute bin→band mapping table at startup
   │
   ├─ per band: level = f(band energy); attack/decay smoothing; peak-hold
   ├─ software auto-gain: track slow running max, normalize so display stays lively
   │
   └─ effect renderer(framebuffer) ─► Protomatter.show()
```

### Band split

- Sample rate fs ≈ 16–22 kHz → Nyquist 8–11 kHz, enough for a music VU meter.
- N-point FFT → bin width = fs/N (e.g. 16 kHz / 512 = 31 Hz/bin).
- Map bins to bands on a **log frequency axis**; sum (or RMS) magnitude within each band.
- Convert to dB for display — human loudness is logarithmic, so a dB scale looks right.

### Effects library (the fun part)

Target a small interface so effects are swappable, e.g.:
```
void render(uint8_t bands[NUM_BANDS], uint8_t peaks[NUM_BANDS], Framebuffer& fb);
```
Ideas: classic rising bars, mirrored bars, peak-dot fall, palette/heat gradients by
level, scrolling spectrogram, beat-flash on low-band transients. Build the pipeline first,
then iterate on effects against a stable band feed.

## Toolchain — RESOLVED: Arduino / C++

See `decisions/0003-toolchain-arduino-cpp.md`. CircuitPython has no SAMD51 ADC-DMA path,
so it can't exercise risk #1 or feed the FFT at a sustained rate. Build with `arduino-cli`,
board `adafruit:samd:adafruit_matrixportal_m4`.

## Open risks (ranked)

1. **Protomatter + ADC-DMA coexistence / framerate** — ✅ RETIRED (`firmware/dma_rms`).
   Finding: **Protomatter on SAMD51 is timer-ISR based (owns TC4, or TC3 fallback) and uses
   NO DMA** (per its own core.c). So there is no DMA contention at all — the only shared
   resource is CPU, and ADC-DMA costs ~zero CPU/sample. Measured: continuous ADC0→DMA on
   DMAC channel 0 at a stable **fs ≈ 13 kHz** while the panel refreshes. Constraints learned:
   - Do **not** use TC4/TC3 (Protomatter owns them). For precise timer-triggered sampling at
     the FFT stage, use a different TC/TCC + the event system.
   - Looped DMA descriptor needs `BLOCKACT_INT` (not `NOACT`) for the per-block TCMPL flag.
   - A1 = PA05 = ADC0/AIN5. Cortex-M4 has no data cache, so DMA writes need no cache mgmt.
2. **Free pins / peripherals** — Protomatter claims most of the broken-out pins for HUB75.
   Confirm A1 (our ADC input) is free (it is on the Matrix Portal). This is also the reason
   we avoided I2S (PCM1808): I2S-capable free pads are not guaranteed and CircuitPython has
   no SAMD51 I2S-input support.
3. **Anti-aliasing** — single-pole RC (~10 kHz) only. For a VU meter, residual aliasing is
   cosmetic. Tighten in hardware later only if a specific band misbehaves.
4. **Dynamic range without AGC** — handled in software (auto-gain). Acceptable; revisit
   only if quiet passages feel dead.

## Build order

1. Analog front-end on breadboard + DMM/scope bring-up. ← current
2. Firmware risk #1 smoke test (matrix + ADC-DMA coexist).
3. FFT → log bands, verify against tones (40 Hz / 1 kHz / 8 kHz should light the right band).
4. Smoothing + auto-gain + peak-hold.
5. Effects library.
