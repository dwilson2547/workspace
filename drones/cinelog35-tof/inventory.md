---
tier: reference
domain: drones
---

# CineLog 3.5 ToF build — parts

Parts for the custom [CineLog 3.5 ToF indoor autonomy build](README.md). This build is assembled
from individual parts (not a kit), so the airframe/electronics are tracked here rather than "shipped
with the craft." Reorder links in [`../inventory/bom.md`](../inventory/bom.md).

## Airframe & power

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| GEPRC GEP-CL35 V3 frame (3.5" ducted) | 1 | fitted | O4-ready |
| MicoAir H743 v2 FC | 1 | fitted | H7. Supersedes the TAKER F722 45A AIO originally planned |
| AM32 4-in-1 ESC (firmware 2.19) | 1 | fitted | DShot600. Motor spin direction is set **in ESC firmware** via AM32 configurator, not in params |
| GEPRC SPEEDX2 2105.5 2450KV motor | 4 | fitted | 4-pack. All four were soldered with identical wire order — ESC 3/4 reversed in firmware to fix |
| HQProp Duct-T90MMX3 props (3.5" ducted) | 12 (6 pairs) | fitted | |
| 4S LiPo pack (~850–1100 mAh) | 1 | in use | 15.2 V start, 14.2 V min under a 52 A peak |

## Control & navigation

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| RadioMaster RP3 ELRS RX (CRSF) | 1 | fitted | bound `dwdrones`; CRSF confirmed in flight logs |
| HGLRC M100-5883 (M10 GPS + compass) | 1 | fitted | external compass (`COMPASS_EXTERNAL,1`); prearm mag-field warning outstanding |
| MicoAir MTF-01 (optical flow + ToF) | 1 | ordering | position/altitude hold |
| TOF400C (VL53L1X) rangefinder | 11 | ordering | obstacle ring; address-collision design TBD |
| Raspberry Pi / SBC companion computer | 0 | **to buy** | model not yet selected |
| I2C multiplexer (TCA9548A) or XSHUT wiring | 0 | **to buy** | needed for 11× VL53L1X (see README) |
