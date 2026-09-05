---
tier: reference
domain: drones
---

# 3" freestyle — parts

Parts for the [3" freestyle build](README.md). Reorder links in
[`../inventory/bom.md`](../inventory/bom.md).

**Built and flying, and the list is now essentially complete** — recovered 2026-09-01 from the
web-bot conversation the build was discussed in. Only the prop model, battery capacity and motor
brand are still open.

## Airframe & power

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| **Angel30** CF frame (3") | 1 | **fitted** | **149 mm** wheelbase; **3.5 mm** arms, **1.5 mm** top/side plates; kit ~**56.6 g**. Takes **20×20 or 25.5×25.5** FC. Ships with printed camera mount + arm protectors/landing skids |
| **SpeedyBee F405 AIO V2** | 1 | **fitted** | F405 + **ICM-42688P** + SPA06-003; **35 A** std / **40 A** CNC per channel, **Bluejay JH-40 48 kHz**; **3–6S**; **4 UARTs**; 8 MB blackbox; BLE; 33×33×7 mm, **25.5×25.5**, **8.9 g**. BECs: **4V5 @ 1 A · 5 V @ 1.5 A · 9 V @ 1.5 A** |
| **iFlight XING 1404, 4600 KV** | 4 | **fitted** | Same platform as the [Y6](../f121-reliant-v2/inventory.md) (which is 3800 KV). **2–4S** — 4S is its ceiling. 9.1 g ea incl. wire; XING2 4600 KV is listed at **17.99 A peak / 287.8 W**, 159 mΩ. **Bought on Amazon for availability**, not chosen on spec |
| **HQProp T3X2X3** | 4 (2 CW / 2 CCW) | **fitted** | 3", **2.0 pitch**, **tri-blade**, polycarbonate, **1.2 g**; hub 9.8 mm × 4.5 mm. ⚠ **buy the 1.5 mm T-mount variant** — it also ships in 2 mm |
| **4S LiPo, 650 mAh** | ? | **in use** | inside the frame's recommended **3–4S, 550–850 mAh**. ⚠ C rating and brand not recorded |

## Control & navigation

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| **RadioMaster RP3 ELRS** receiver | 1 | **fitted — UART6** | bind phrase `dwdrones`; same RX as the [Reliant Y6](../f121-reliant-v2/inventory.md) |
| **RushFPV Cherry antenna** | 1 | **fitted** | 5.8 GHz RHCP, 1.2 dBi, 98 % efficiency, 7.5 g. Also on the Reliant Y6; supersedes the RHCP antenna bundled with the HDZero VTX kit. ⚠ must be the **U.FL** variant — the MMCX one came with the Rush Tank |

### Port map

| Port | Device |
|---|---|
| **UART3** | HDZero Freestyle V2 VTX — MSP DisplayPort |
| **UART6** (+SBUS) | RP3 ELRS receiver |
| UART4, UART5 | **spare** |

## Video / FPV — HDZero

Bought as the **HDZero Freestyle V2 VTX Kit**, which is why the camera wasn't a separate choice.
Kit contents: VTX · **Nano90 camera (19×19 mount)** · RHCP antenna · **120 mm MIPI cable** · power
cable · SA cable · mounting bars, screws, tape.

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| **HDZero Freestyle V2 VTX** | 1 | **fitted — UART3** | **7–25 V (2S–6S)**, 25–1000 mW, **6–15 W**, 540p90/720p60/1080p30, 29×30×14 mm, **20×20 M2**, 22.3 g. ⚠ the only **20×20** HDZero VTX in the fleet — doesn't swap with the 25.5×25.5 units. ⚠ at 9 V its 15 W peak is **1.67 A vs the FC's 1.5 A BEC** |
| **HDZero Nano90** camera | 1 | **fitted — being replaced** | **came in the VTX kit**, not chosen. 1/3" sensor, 540p90 / 720p60 4:3, 160°/127°/92°, 5.2 g, **19×19 mount**. Image judged poor |
| MIPI cable, 120 mm (kit) | 1 | **fitted** | from the VTX kit |
| HDZero RHCP antenna (kit) | 1 | **spare** | superseded by the Cherry |
| _Replacement:_ **HDZero Nano V3** | 1 | **candidate** | 1/2" sensor, 720p60 4:3, 155°/126°/94°, **2.2 g**, 14 mm — like-for-like, proven on the Y6 |
| _Replacement:_ **HDZero Micro V3** | 1 | **candidate** | 1/2", 1080p30 native **16:9**, 157°/133°/72°, 7.5 g, **19 mm** — best image, needs the bay for it |
| MIPI cable | — | on hand | 40 / 80 / 120 mm spares — see [`../inventory/bom.md`](../inventory/bom.md) |
| _(ground side)_ HDZero ProBox+ | — | on hand | shared |

## Removed — the original analog system

The build **started analog and was converted to HDZero**. Both parts came off working and are now
[unassigned spares](../inventory/shared-gear.md).

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| **RushFPV Tank Ultimate Mini** | 1 | **removed — spare** | ✅ **identified from the PCB silkscreen** (the Amazon listing was branded "SoloGood", a reseller). **7–36 V in (2–8S)**, 5 V/1 A out, 48 ch, **PIT/25/200/500/800 mW**, **20×20 mm**, **MMCX elbow**, SmartAudio. The wide input makes it easy to reuse on anything |
| **Caddx Ratel 2** camera | 1 | **removed — spare** | 1/1.8" starlight sensor analog freestyle cam — a good low-light camera, worth reusing rather than shelving |
| **RushFPV Cherry antenna** (MMCX) | 1 | **bundled with the VTX** | 5.8 GHz RHCP, 1.2 dBi, SWR 1.1–1.4, 98 % efficiency, 63 mm, 7.5 g. ⚠ **MMCX** — see the connector note below |

### ⚠ Connector mismatch — the bundled Cherry is MMCX, the HDZero VTXs are U.FL

**This is where the Cherry antenna in this fleet came from**: it was bundled with the Rush Tank, not
bought separately. But the Rush's is an **MMCX elbow**, while the **HDZero Freestyle V2 is U.FL** (as
is the Whoop V2 on the [Y6](../f121-reliant-v2/inventory.md)).

So the Cherries actually fitted to the two aircraft **must be U.FL variants** — RushFPV sells Cherry
in U.FL, MMCX and SMA — and the MMCX one from this bundle **cannot go on either HDZero VTX without
an adapter**. Worth confirming which variant is on each aircraft, and keeping the MMCX one with the
Rush Tank it belongs to.

_Note there is also a **Cherry 2**: 1.8 dBi average (vs 1.2), VSWR ≤1.3, 99 % efficiency, ~30 %
smaller and 20 % lighter. A cheap upgrade if a Cherry ever needs replacing._
