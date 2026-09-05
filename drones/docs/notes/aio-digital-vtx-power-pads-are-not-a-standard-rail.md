---
title: AIO digital-VTX power pads are not a standard rail
date: 2026-09-01
tags: fpv,vtx,hdzero,power,wiring
---

An AIO flight controller's 'digital VTX' power pad supplies whatever that board's designer chose — anywhere from a regulated 5V to raw pack voltage — so it must be read off that board's manual, never carried across from the last build. Verified across four boards: MicoAir H743 v2 AIO gives a regulated 12V, HDZero Gamma 45A gives a protected 8V/3A, SpeedyBee F405 AIO V2 gives 9V, and the HGLRC Specter 6-in-1's pad is labelled 7.4-26.4V (raw pack). This destroyed an HDZero Whoop V2 (rated 3-12.6V, 1S-3S, no reverse-polarity protection) on a 4S pack in Sept 2026. The trap is that a 12V regulated pad looks like it proves pack voltage is safe, when it is really 0.6V under the VTX's ceiling.

Check current as well as voltage: the pad can be in range and still undersized. An HDZero Freestyle V2 draws 6-15W, which on the SpeedyBee's 9V rail peaks at 1.67A against a 1.5A BEC — in spec on voltage, over budget on current at full transmit power. So the check before every first power-up is two-sided: the VTX's input range against the pad's voltage, and the VTX's peak wattage against the BEC's current rating. Where a VTX has a wide input range, feeding it from pack voltage instead of a BEC sidesteps the current ceiling entirely.

The general retrofit when a board's pad is wrong is a small standalone step-down (a Matek Micro BEC, 6-60V in, 5V/9V/12V out by solder jumper, ~2.6-2.8A at 4S, 2g) — it decouples the VTX from the FC's design choices and adds OCP and thermal shutdown the raw pad has neither of. When picking its output, aim for the middle of the VTX's range rather than just inside it: for a 3-12.6V part choose 5V or 9V, not 12V. "Technically in spec" with 0.6V of headroom is how the original mistake gets rebuilt in a different place.
