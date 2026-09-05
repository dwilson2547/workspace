---
tier: reference
domain: drones
---

# DH600 build — parts

Parts for the custom [DH600 long-endurance cinematic build](README.md). Assembled from individual
parts (not a kit), so the airframe and electronics are tracked here rather than "shipped with the
craft." **Most of the airframe is bought and mounted as of 2026-08-17.** Reorder links in
[`../inventory/bom.md`](../inventory/bom.md).

Prices are the quoted AliExpress totals from the source list ([`parts_list.txt`](parts_list.txt)) at
drafting time (2026-07-26) — they drift, treat as indicative.

## Airframe & power

| Item | Qty | Status | Price | Notes |
|------|-----|--------|-------|-------|
| DH600 CF folding frame kit, 600 mm | 1 | **mounted** | — | 398 g; incl. gear, GPS mast, canopy |
| SunnySky X4110S 400 KV motor | 4 | **mounted 2026-08-17** | $53.74 | 165 g ea; 45 A/30 s, 1125 W; wants a 40–60 A ESC |
| Hobbywing XRotor 40 A 3–6S ESC | 4 | **mounted 2026-08-17** | $19.15 | 50 g ea; 40 A cont / 60 A burst (10 s) |
| CF 1555 prop (15×5.5) | 4 | **to buy** | $19.99 | matches frame recommendation — confirm whether these came with the motors |
| ~~Holybro PDB (60 A, 6S)~~ | — | dropped | $27.87 | XT60 input only 30 A cont.; keep as X500 spare |
| ~~50 mm 8-in-1 200 A hub~~ | — | dropped | — | unnecessary — PM07's B+ pads distribute to the ESCs |
| 8 AWG wire + **AS150** connector pair | 1 set | **to buy** | ~$15 | re-pigtail the power module input (XT120 min) |
| 6S LiPo **12000 mAh** 15C (Tattu, AS150) | 1 | **to buy** | **$270** | 1619 g; AS150 pre-fitted; ~37 min |
| 6S LiPo **5000–6000 mAh** (shakedown packs) | 2 | **to buy** | ~$60–90 ea | ~24–27 min; for maiden/ESC cal/PID tuning — keeps the $270 pack out of risky sorties |
| **12 V / 3 A BEC** (36 W) | 1 | **to buy** | ~$15 | feeds HM30 air unit (11–16.8 V) **and** A8 mini (~1 A); 5.2 V rails won't do |

## Control & navigation

| Item | Qty | Status | Price | Notes |
|------|-----|--------|-------|-------|
| Pixhawk 6C (full size) + M10 + PM07 kit | 1 | **on hand** | ~$300 | replaces the 6C Mini bundle; ⚠ still confirm the shipped module is a PM07 |
| M10 GPS / compass | 1 | **mounted 2026-08-17** | — | on the folding GPS mast |
| Holybro PM07 power module | 1 | **mounted 2026-08-17** | — | 90 A cont / 140 A burst; hover 15.5 A = 17 %, vigorous 37 A = 41 %; B+ pads + PWM header = ESC distribution; 2× 5.2 V/3 A BEC |
| Pixhawk 6C (the board itself) | 1 | **on hand, not secured** | — | ⛔ **blocked on the soft mount** — nothing else in the bay gets fixed down first |
| ~~Holybro PM08-CAN + 300 A PDB~~ | — | rejected | ~$150 | margin never reached in flight — see README |
| FC soft mount | 1 | **on hand** | ? | ⚠ **taller than the factory top plate allows** — which is what forced the custom plate below |
| **Custom top plate** (printed/cut) | 1 | ⛔ **to design — critical path** | ~$0 | replaces the factory plate, which doesn't clear the FC on its soft mount. Carries **FC + HM30 air unit + AI Tracking Module**; must **vent the HM30's fan** and anchor the antenna booms |
| **Custom front gimbal mount** (printed) | 1 | **to design** | ~$0 | swing-up / detachable, so the A8 mini isn't the lowest-hanging part with the gear folded. Check antenna keep-out against gimbal yaw in the **flight** position |
| FC silicone bushings | 1 set | **to buy** | $2.66 | vibration isolation; ⚠ may be redundant with the soft mount above — check before buying both |
| **Dronetag BS** Remote ID module | 1 | **mounted 2026-08-17** | ? | same as the CL35. Standalone GNSS + BLE broadcast, no UART to the FC. Serial goes on the FAA registration, not the aircraft's |
| RadioMaster RP3 ELRS RX (CRSF) | 1 | **to buy** | $18.48 | **on the aircraft**, CRSF into GPS2; bind phrase `dwdrones`; run at **50 Hz** for range |
| SiK 915 MHz telemetry radio | 1 | check X500 spare | — | on TELEM2; may need a second set if the X500's stays put |
| Antenna booms/brackets (printed) | 5 | **to make** | ~$0 | centre-body downward booms — must not cross the folding arms or retract gear; RP3 pair orthogonal and widely separated |
| muzi works 17 cm 915 MHz whip | **2** | **to buy** | ~$10 ea | one per SiK end (aircraft + laptop). SWR 1.3 vs stock 3.5, ~3–6 dB. Airframe one is **184 mm — mount pointing up**, won't clear the 135 mm gear |
| _Later, if logs justify:_ tripod/mast ground setup | 1 | wait and see | ? | decide from logged SiK RSSI, not speculation |
| _Possible upgrade:_ F9P-class RTK rover GPS | 1 | future | ~$200–300 | RTK base already on the roof; **M10 cannot do RTK**. Send RTCM over the HM30 link, not the SiK |
| _Have:_ 5.8 dBi 915 MHz collinear (roof) | 1 | on hand | — | suits long range/low elevation; weak overhead; roof-fixed. Check feedline loss before assuming it beats a laptop whip |

## Video & payload

| Item | Qty | Status | Price | Notes |
|------|-----|--------|-------|-------|
| SIYI HM30 air unit | 1 | **on hand, not mounted** | $314.56 | 5.8 GHz; 74 g, 70×55×16 mm, **11–16.8 V in**; S.Bus out unused. Mounting held until the **custom top plate** exists |
| SIYI HM30 ground unit | 1 | **on hand** | (in HM30 price) | ground side of the link |
| SIYI A8 mini gimbal camera | 1 | **on hand** | $274.36 | 95 g, 55×55×70 mm; 11–25.2 V, 12 W peak; native ArduPilot driver. Goes on the **custom swing-up front mount** |
| SIYI AI Tracking Module 2 (10T) | 1 | **on hand 2026-09-01** | ? | 10 TOPS onboard tracking. ⚠ **still not in the mass/power/topology budget** — weigh it, check its input voltage against the shared 12 V rail, and confirm whether it sits inline on the gimbal↔air-unit Ethernet. Now measurable rather than theoretical |
| SIYI LAN → HDMI converter | 1 | **on hand 2026-09-01** | ? | ground unit → goggles, as an alternative to the laptop station |
| SIYI Gimbal-to-Link Ethernet cable | 1 | **to buy** | ? | A8 mini → HM30 air unit, video. ⚠ **re-check the cable set** once the tracking module's position in the chain is known |
| ~~SIYI S.Bus Y cable~~ | — | not needed | — | gimbal driven by MAVLink over TELEM3, not air-unit S.Bus |

⚠ Confirm which of these cables ship with the HM30 / A8 mini bundles before ordering separately.

## Cost

Original list totalled **≈ $1041**, including the now-dropped $27.87 Holybro PDB and the $310.57 6C
Mini kit. Net of those and with the ~$300 full-size 6C + PM07 bundle, the electronics come to **≈ $1003**.

| Add | Cost |
|-----|------|
| Tattu 6S 12 Ah 15C (AS150) | $270 |
| 8 AWG + AS150 re-pigtail parts | ~$15 |
| 12 V BEC for HM30 air unit | ~$15 |
| **Build total** | **≈ $1300** |
| _Optional:_ 2× 6S 5–6 Ah shakedown packs | +$120–180 |

No separate PDB needed — the power module distributes. A DC supply for the charger may also be wanted
(see README, charging).
