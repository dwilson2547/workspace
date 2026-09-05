---
tier: reference
domain: drones
---

# CineLog 3.5 ToF build — parts

Parts for the custom [CineLog 3.5 ToF indoor autonomy build](README.md). This build is assembled
from individual parts (not a kit), so the airframe/electronics are tracked here rather than "shipped
with the craft." Reorder links in [`../inventory/bom.md`](../inventory/bom.md).

**~99 % assembled as of 2026-08-17** — nearly everything below is fitted to the airframe.

## Airframe & power

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| GEPRC GEP-CL35 V3 frame (3.5" ducted) | 1 | **fitted** | plastic, not CF |
| **MicoAir H743 v2 AIO** | 1 | **fitted** | STM32H743. Built-in **AM32 4-in-1 ESC** (fw 2.19), DShot600 — motor spin direction is set **in AM32 firmware**, not in params |
| GEPRC SPEEDX2 2105.5 2450KV motor | 4 | **fitted** | 4-pack. All four soldered with identical wire order — ESC 3/4 reversed in firmware to fix |
| HQProp Duct-T90MMX3 props (3.5" ducted) | 12 (6 pairs) | **fitted** | |
| 4S 1300 mAh LiPo pack | 1 | **in use** | 15.2 V start, 14.2 V min under a 52 A peak; `BATT_CAPACITY = 1300` |
| Self-powered buzzer | 1 | **on order** | for the BZ pad; `RC7_OPTION = 30` is inert until fitted |

## Control & navigation

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| RadioMaster RP3 ELRS RX (CRSF) | 1 | **fitted** | bound `dwdrones`; 250 Hz, telem 1:4; CRSF confirmed in flight logs |
| HGLRC M100-5883 (M10 GPS + compass) | 1 | **fitted** | external compass (`COMPASS_EXTERNAL = 1`); `COMPASS_ORIENT = 2` (`YAW_90`), auto-derived and flight-verified 2026-08-02 |
| MicoAir MTF-01 (optical flow + ToF) | 1 | **fitted** | ⚠ not yet configured in ArduPilot |
| TOF400C (VL53L1X) rangefinder | 11 | **fitted + wired** | full obstacle ring |
| **PCA9548A I²C mux** | 2 | **fitted + wired** | 8 ch each; resolves the shared `0x29` address |
| **Waveshare ESP32-S3-Zero** (companion) | 1 | **on hand, not wired** | ⛔ **the only hardware left** — wire to the mux stack, and to the FC |
| Dronetag BS (Remote ID) | 1 | **fitted** | ⚠ **record where its 12 V now comes from** — the HDZero VTX took the VTX connector on 2026-08-17 |

## Video — HDZero

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| HDZero Whoop V2 VTX (bundle) | 1 | **fitted + wired** | bundle included a 14 mm camera + 40 mm MIPI cable |
| HDZero Micro V3 camera (19 mm) | 1 | **fitted + wired** | the CL35 takes 19 mm; the bundled 14 mm doesn't fit |
| MIPI cable, 40 mm | 1 | spare (bundled) | **too short** for this build — this is what prompted the order |
| MIPI cable, 80 mm | 2 | **1 fitted, 1 spare** | confirmed the right length for this build |
| MIPI cable, 120 mm | 1 | **on hand** | spare; with the above, a full length array for the next build |
| HDZero ProBox+ | 1 | **on hand** | ground side |
