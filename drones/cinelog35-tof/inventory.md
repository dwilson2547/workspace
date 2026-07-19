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
| GEPRC GEP-CL35 V3 frame (3.5" ducted) | 1 | ordering | O4-ready |
| TAKER F722 45A 32-bit AIO FC | 1 | ordering | F7 |
| GEPRC SPEEDX2 2105.5 2450KV motor | 4 | ordering | 4-pack |
| HQProp Duct-T90MMX3 props (3.5" ducted) | 12 (6 pairs) | ordering | |
| 4S LiPo pack (~850–1100 mAh) | 0 | **to buy** | not yet selected |

## Control & navigation

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| RadioMaster RP3 ELRS RX (CRSF) | 1 | ordering | flash + bind `dwdrones` |
| HGLRC M100-5883 (M10 GPS + compass) | 1 | ordering | optional outdoor |
| MicoAir MTF-01 (optical flow + ToF) | 1 | ordering | position/altitude hold |
| TOF400C (VL53L1X) rangefinder | 11 | ordering | obstacle ring; address-collision design TBD |
| Raspberry Pi / SBC companion computer | 0 | **to buy** | model not yet selected |
| I2C multiplexer (TCA9548A) or XSHUT wiring | 0 | **to buy** | needed for 11× VL53L1X (see README) |
