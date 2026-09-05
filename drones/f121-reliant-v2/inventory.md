---
tier: reference
domain: drones
---

# Reliant V2 (F121) — parts

Parts for the [Reliant V2 Y6 build](README.md). Reorder links in
[`../inventory/bom.md`](../inventory/bom.md).

**Built as of 2026-09-01.** The sub-250 g target was abandoned — this is a **4S** aircraft — so the
weight-budget framing this list was originally written around no longer applies. One line is still
open: the **replacement VTX**.

## Airframe & power

| Item | Qty | Status | Price | Notes |
|------|-----|--------|-------|-------|
| Reliant V2 CF frame (cncdrones F121) | 1 | **fitted** | $29.00 | cut to order; V2 fits without filing |
| **HGLRC Specter 6-in-1 AIO** (F722 + 40 A ESC) | 1 | **fitted** | $99.99 | **13.2 g** (manual; the listing's 14 g is wrong), 34×48 mm, 25.5×25.5 M2, 8.4–26.1 V, **3 UARTs**, target `HGLRCF722AIO_X6`. ⚠ **video pad is `7.4–26.4 V` = pack voltage**; BEC currents unpublished |
| **iFlight XING 1404 3800 KV** motor | 6 | **fitted** | ? | 9.1 g ea (~55 g total); **2–4S**, 11.8 A / 174.6 W max continuous — 4S is its rated ceiling. 1.5 mm shaft (XING2-generation) |
| **iFlight Nazgul T4030** prop | 6 (3 CW / 3 CCW) | **fitted** | ? | 4×3.0 2-blade, **T-mount, 1.5 mm** hub. Buy spares to the shaft size, not the name |
| **4S LiPo pack** | ? | **in use** | ? | supersedes the designer's 3S Li-Ion. ⚠ the pack that killed the VTX — capacity/C not recorded |

## Control & navigation

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| **RadioMaster RP3 ELRS** receiver | 1 | **fitted** | bind phrase `dwdrones`; same RX as the [3" freestyle](../freestyle-3in/inventory.md) |
| **Cherry antenna** | 1 | **fitted** | also on the 3" freestyle |
| GPS module | 0 | **not fitted** | optional; a TPU GPS mount is in the print files. ⚠ would take the last of only **3 UARTs** |

## Video / FPV

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| **HDZero Whoop V2 VTX** | 1 | ⛔ **destroyed** | fed 16.8 V from the FC's `7.4–26.4 V` pad against a **3–12.6 V** rating. See [the failure writeup](README.md#-vtx-failure--the-video-power-pad-is-pack-voltage) |
| **HDZero Whoop V2 VTX** (replacement) | 1 | **due 2026-09-02** | ⚠ **must not go on the same pad** — powered from the Matek BEC below |
| **Matek Micro BEC** (6–60 V → 5/9/12 V) | 1 | **on hand** ✅ | the fix. 2.8 A @5 V / 2.6 A @9 V at 4S in, 3 A max; **OCP + hiccup, thermal shutdown**; 18×15×4.5 mm, **2 g**. ⚠ **leave at the 5 V default or jumper to 9 V — never 12 V** (only 0.6 V under the VTX's ceiling) |
| **HDZero Nano V3 camera** | 1 | **fitted** | 1/2" sensor, 720p60 4:3, D155°/H126°/V94°, **2.2 g**, 14×16×14 mm |
| Capacitor at the VTX supply | 1 | **to fit** | HDZero "strongly suggests" one even at 3S; the printed holder has a place for it |
| _(ground side)_ HDZero ProBox+ | — | on hand | shared |

## Printed parts

TPU mounts from the [Thingiverse download](https://www.thingiverse.com/thing:4845387) — designer's
settings **0.2 mm layer, 20 % infill, TPU**. The last two are custom, designed for this aircraft.

| Part | Qty | Status |
|------|-----|--------|
| TPU camera mount | 1 | **printed + fitted** |
| TPU GPS mount | 1 | not needed — no GPS fitted |
| **XT60 / capacitor / ELRS-antenna holder** (custom) | 1 | **printed + fitted** |
| **Landing gear** (custom) | 1 set | **printed + fitted** |

## Hardware

Frame ships with CF **and hardware** from cncdrones — check what arrives against this before buying.
**Aluminium spacer bolts are the designer's recommendation for weight saving.**

| Purpose | Hardware | Status |
|---|---|---|
| Motor plates → arms | 12× M2 6 mm spacer bolts + 24× M2 3 mm screws | check kit |
| Arms → main plates | 6× M2 18 mm spacer bolts + 12× M2 4 mm screws | check kit |
| TPU camera mount | 2× M2 18 mm spacer bolts + 4× M2 4 mm screws | check kit |
| TPU GPS mount | 1× M2 8 mm (or 10 mm) + 1× M2 nut | check kit |

_Designer's hint: the 6 mm motor-plate standoffs are **optional** — an M2×10 mm screw and bolt does
the same job; he uses the spacers because they align more easily._

## Weight

**No longer a budget — the sub-250 g target was abandoned when the build went 4S.** Kept as a
reference table; **AUW has never been measured**, which is the one number still worth having.

| Item | Mass |
|---|---|
| HGLRC Specter 6-in-1 AIO | **13.2 g** (manual) |
| 6× XING 1404 3800 KV | **~55 g** (9.1 g ea, incl. wire) |
| HDZero Nano V3 camera | **2.2 g** |
| Frame (CF + hardware) | ? |
| 6× Nazgul T4030 prop | ? |
| RP3 + Cherry antenna | ? |
| HDZero Whoop V2 VTX | ? |
| Printed parts (TPU mounts, XT60/cap holder, landing gear) | ? |
| Wiring, hardware | ? |
| 4S LiPo pack | ? |
| **Measured AUW** | **⚠ never taken** |
