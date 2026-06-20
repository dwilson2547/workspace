# 0001 — The Matrix Portal M4 is a SAMD51, not an ESP32

**Status:** accepted · **Date:** 2026-06-14

## Context

Project was conceived as an "ESP32 LED VU meter using the built-in ADC." The chosen board
is the Adafruit Matrix Portal M4.

## Decision

Treat the controller as a **Microchip SAMD51** (Cortex-M4F @ 120 MHz, hardware FPU). The
onboard **ESP32 is only a WiFi co-processor (AirLift)** — not the application CPU and not
the ADC we use. All "ESP32 ADC" assumptions are dropped.

## Consequences

- We use the **SAMD51 12-bit ADC**, which is far more linear than the ESP32's notoriously
  nonlinear ADC — a net win.
- Hardware FPU makes floating-point FFT (CMSIS-DSP) cheap.
- The board's purpose is driving HUB75 panels (Protomatter), which we rely on.
- Firmware targets SAMD51 (Arduino SAMD core or CircuitPython), **not** the ESP32 toolchain.
