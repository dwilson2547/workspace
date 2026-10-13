---
title: PlatformIO needs Python 3.10-3.13; the PATH pio is 3.14
date: 2026-09-07
tags: platformio,embedded,python,toolchain
---

The `pio` on PATH resolves to ~/miniconda3/envs/py314 and aborts immediately with 'ERROR: Python version must be between 3.10 and 3.13' -- it is not a broken install. A working PlatformIO Core 6.1.19 lives in the dedicated env: ~/miniconda3/envs/pio/bin/pio (Python 3.12.13). Use that path for any embedded build on this machine.
