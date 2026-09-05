---
tier: reference
domain: drones
---

# X500 — parts on hand

Parts assigned to the Holybro X500 V2. Airframe kit contents (frame, motors, ESCs, props, PDB,
Pixhawk 6C, M10 GPS, 915 MHz telemetry) ship with the craft — see [`README.md`](README.md). This
tracks batteries, the RC receiver, and spares specific to this craft. Reorder links in
[`../inventory/bom.md`](../inventory/bom.md).

## Batteries

| Pack | Connector | Qty | Notes |
|------|-----------|-----|-------|
| OVONIC 4S 14.8V 4500mAh 50C | XT60 | 2 | main flight packs |

## RC / radio

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| RadioMaster RP3 ELRS receiver | 1 | not installed | flash + bind with phrase `dwdrones` ([rx setup](../docs/topics/elrs/rx-x500-rp3.md)) |

## Payload — VLP-16 lidar

Decided 2026-08-17 (replaces the dropped RoboSense Airy). Sensor and box are **already owned** —
shared with [`tools/point-cloud-visualizer`](../../tools/point-cloud-visualizer/docs/vlp16-getting-started.md),
so the X500 borrows them rather than owning them outright.

| Item | Qty | Status | Notes |
|------|-----|--------|-------|
| Velodyne VLP-16 Lite (Puck LITE) | 1 | **on hand** (shared) | ~590 g vendor spec — **weigh the actual unit** before AUW math |
| VLP-16 interface box + round cable | 1 | **on hand** (shared) | needs **12 V**; supplies power *and* data to the sensor |
| ~~RoboSense Airy~~ | — | **dropped** | price static + import regulation; superseded by the VLP-16 |
| Body-slung lidar mount | 0 | **to make** | print/machine; clear the 215 mm gear, keep legs out of the ±15° FOV |
| Mount soft-isolation (grommets/dampers) | 0 | **to buy** | spinning sensor on a 1045-prop airframe |
| 12 V BEC (for the interface box) | 0 | **to buy** | off the 4S pack via a PDB XT30 tap; size once box draw is measured |
| Companion computer w/ Ethernet NIC | 0 | **to buy** | now **required** — the 6C has no Ethernet; model not selected |

## Spares

| Item | Qty | Notes |
|------|-----|-------|
| 1045 props | 2 (1 pair: 1 CW + 1 CCW) | spare set |
| 2216 KV920 motor | 0 | |
| BLHeli-S 20A ESC | 0 | |
