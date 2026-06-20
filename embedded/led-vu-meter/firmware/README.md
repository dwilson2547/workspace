# firmware

Empty until milestone 2. Toolchain (Arduino/C++ vs. CircuitPython) is decided then —
see `../docs/design.md`. First code here is the **risk #1 smoke test**: Protomatter panel
refresh running concurrently with ADC-DMA sampling, before any FFT or effects.
