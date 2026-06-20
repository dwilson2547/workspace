# 0003 — Firmware toolchain: Arduino / C++

**Status:** accepted · **Date:** 2026-06-14

## Context

Toolchain choice was deferred to firmware bring-up (milestone 2). Two candidates:
Arduino/C++ (Adafruit_Protomatter + CMSIS-DSP) vs. CircuitPython (rgbmatrix + ulab FFT).

## Decision

**Arduino / C++.**

## Rationale

- The risk we must retire first (design.md risk #1) is **continuous ADC-DMA coexisting
  with Protomatter** at framerate. CircuitPython exposes only blocking single ADC reads
  (`analogio.AnalogIn`) — no DMA — so it literally cannot exercise that risk, nor deliver
  the sustained sample rate the FFT needs.
- Hardware FPU + CMSIS-DSP makes the FFT cheap in C++.
- Headroom for FFT + effects + 2048-px refresh simultaneously.

## Consequences

- Build via Arduino IDE or `arduino-cli`, board `adafruit:samd:adafruit_matrixportal_m4`.
- Libraries: Adafruit Protomatter (+ Adafruit GFX); CMSIS-DSP added at the FFT milestone.
- Bring-up sketch: `firmware/smoke_test/`. DMA sampling lands in the next iteration.
