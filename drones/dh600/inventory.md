---
tier: reference
domain: drones
---

# DH600 build — parts

Parts for the custom [DH600 long-endurance cinematic build](README.md). Assembled from individual
parts (not a kit), so the airframe and electronics are tracked here rather than "shipped with the
craft." Nothing ordered yet. Reorder links in [`../inventory/bom.md`](../inventory/bom.md).

Prices are the quoted AliExpress totals from the source list ([`parts_list.txt`](parts_list.txt)) at
drafting time (2026-07-26) — they drift, treat as indicative.

## Airframe & power

| Item | Qty | Status | Price | Notes |
|------|-----|--------|-------|-------|
| DH600 CF folding frame kit, 600 mm | 1 | **ordered 2026-07-26** | — | 398 g; incl. gear, GPS mast, canopy |
| SunnySky X4110S 400 KV motor | 4 | **to buy** | $53.74 | 165 g ea; 45 A/30 s, 1125 W; wants a 40–60 A ESC |
| Hobbywing XRotor 40 A 3–6S ESC | 4 | **to buy** | $19.15 | 50 g ea; 40 A cont / 60 A burst (10 s) |
| CF 1555 prop (15×5.5) | 4 | **to buy** | $19.99 | matches frame recommendation |
| ~~Holybro PDB (60 A, 6S)~~ | — | dropped | $27.87 | XT60 input only 30 A cont.; keep as X500 spare |
| ~~50 mm 8-in-1 200 A hub~~ | — | dropped | — | unnecessary — PM07's B+ pads distribute to the ESCs |
| 8 AWG wire + **AS150** connector pair | 1 set | **to buy** | ~$15 | re-pigtail the power module input (XT120 min) |
| 6S LiPo **12000 mAh** 15C (Tattu, AS150) | 1 | **to buy** | **$270** | 1619 g; AS150 pre-fitted; ~37 min |
| 6S LiPo **5000–6000 mAh** (shakedown packs) | 2 | **to buy** | ~$60–90 ea | ~24–27 min; for maiden/ESC cal/PID tuning — keeps the $270 pack out of risky sorties |
| **12 V / 3 A BEC** (36 W) | 1 | **to buy** | ~$15 | feeds HM30 air unit (11–16.8 V) **and** A8 mini (~1 A); 5.2 V rails won't do |

## Control & navigation

| Item | Qty | Status | Price | Notes |
|------|-----|--------|-------|-------|
| Pixhawk 6C (full size) + M10 + PM07 kit | 1 | **to buy** | ~$300 | replaces the 6C Mini bundle; ⚠ confirm PM07 |
| M10 GPS / compass | 1 | in FC kit | — | mounts on folding GPS mast |
| Holybro PM07 power module | 1 | in FC kit | — | 90 A cont / 140 A burst; hover 15.5 A = 17 %, vigorous 37 A = 41 %; B+ pads + PWM header = ESC distribution; 2× 5.2 V/3 A BEC |
| ~~Holybro PM08-CAN + 300 A PDB~~ | — | rejected | ~$150 | margin never reached in flight — see README |
| FC silicone bushings | 1 set | **to buy** | $2.66 | vibration isolation |
| RadioMaster RP3 ELRS RX (CRSF) | 1 | **to buy** | $18.48 | **on the aircraft**, CRSF into GPS2; bind phrase `dwdrones`; run at **50 Hz** for range |
| SiK 915 MHz telemetry radio | 1 | check X500 spare | — | on TELEM2; may need a second set if the X500's stays put |
| Antenna brackets (printed or tube clamp) | 5 | **to make/buy** | ~$0 | fixed mounts for 5 antennas, clear of carbon; RP3 pair orthogonal |
| _Optional:_ directional ground-station antenna | 1 | consider | ? | patch/helical/moxon — where the real long-range gain is |

## Video & payload

| Item | Qty | Status | Price | Notes |
|------|-----|--------|-------|-------|
| SIYI HM30 (HD video + telemetry) | 1 | **to buy** | $314.56 | 5.8 GHz; air unit 74 g, 70×55×16 mm, **11–16.8 V in**; S.Bus out unused |
| SIYI A8 mini gimbal camera | 1 | **to buy** | $274.36 | 95 g, 55×55×70 mm; 11–25.2 V, 12 W peak; native ArduPilot driver |
| SIYI Gimbal-to-Link Ethernet cable | 1 | **to buy** | ? | A8 mini → HM30 air unit, video |
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
