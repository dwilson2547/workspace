---
title: ArduPilot build standard — shared radio/channel setup across the fleet
date: 2026-09-17
tags: ardupilot,elrs,channels,radio,convention,preflight
source: drones/dh600/dh600.param
---

# ArduPilot build standard

The ArduPilot builds share **one radio setup**, so a single TX16S model works across the fleet.
The ELRS channel profile was built for the X500 and copied to the CineLog 3.5 ToF and the DH600.
New ArduPilot builds copy this table rather than re-deriving it — and rather than letting anyone
(or any agent) invent assignments. Both current param dumps agree on every row
([`../../x500/x500.param`](../../x500/x500.param), [`../../dh600/dh600.param`](../../dh600/dh600.param),
verified 2026-09-17).

| Param | Value | Meaning |
|-------|-------|---------|
| `FLTMODE_CH` | **6** | flight modes on **RC6** — 3-position switch: Stabilize / PosHold / AutoTune |
| `RC5_OPTION` | **153** | **arm/disarm on RC5** — dedicated 2-position switch |
| `RC2_REVERSED` | **1** | **pitch channel inverted** |
| `RCMAP_PITCH/ROLL/THROTTLE/YAW` | 2 / 1 / 3 / 4 | default AETR mapping |

Applies to: **X500**, **DH600** (both ✅ in their param files); **CineLog 3.5 ToF** once its FC is
configured (⬜ — no `.param` dump exists yet).

## Pre-flight gotchas this standard exists to catch

- **Pitch inversion.** `RC2_REVERSED=1` must be set *and* confirmed during radio calibration
  before takeoff. It is the most-forgotten step on a fresh build or a freshly copied profile —
  2026-09-17 was no exception; it was caught on the sticks, not in the checks. Make "wiggle pitch,
  watch the artificial horizon" an explicit arming-checklist line on every new build.
- **`FLTMODE_CH=6` is not the ArduPilot default (5).** Anyone working from the default — or from
  a "typical" setup recalled from memory — will put modes on the arm switch's channel and then
  "discover" conflicts that don't exist. This is exactly the class of invented value that
  `CONVENTIONS.md` §10 forbids: the fleet standard is *this table*, not the ArduPilot default and
  not whatever a generic setup guide says.
- **Copied profiles drift silently.** When a new build copies the X500's TX16S model, diff the
  new craft's first param dump against this table on the bench, before the maiden — channel maps
  are cheap to check on the ground and expensive to discover in the air.
