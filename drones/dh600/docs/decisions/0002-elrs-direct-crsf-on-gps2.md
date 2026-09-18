---
kind: decision
status: superseded
date: 2026-07-26T20:14:21-04:00
supersedes: 0001
superseded_by: 0003
satisfies: [0004]
source: bd5ef70
---

# 0002 — ELRS direct on the aircraft, CRSF into GPS2

## Context

Recorded retroactively on 2026-09-17 from commit `bd5ef70`. [0001](0001-rc-relay-through-hm30.md) tied control range to the video link. Putting the RP3 on the
aircraft decouples them. The question became which FC port takes it.

## Options

- RP3 as S.Bus into RC IN. One-way; no telemetry back to the TX16S.
- **RP3 as CRSF into GPS2 (UART8).** Bidirectional; TELEM1 kept for the HM30 because TELEM1 has
  RTS/CTS and MAVLink telemetry was assumed to want it.
- Gimbal: MAVLink over TELEM3 via ArduPilot's SIYI driver, driven by RC6/RC7 from ELRS. RC6/RC7
  came from the ArduPilot mount wiki page, not from the fleet's param files.

## Decision

CRSF on GPS2, HM30 MAVLink on TELEM1, gimbal on TELEM3 with `RC6_OPTION`/`RC7_OPTION` = 213/214.
Written into the README port table in the present tense.

## Consequences

- The README read as a wiring record for seven weeks. When the aircraft was actually wired the
  RP3 went to TELEM1, and the stale GPS2 row cost a bench session on 2026-09-17
  (`drones/docs/issues/2026_09_17_agent_invented_hardware_specs.md`).
- RC6 is the fleet flight-mode channel (`FLTMODE_CH=6` on every ArduPilot build), so the
  RC6/RC7 mount mapping was never viable. Rejected in [0003](0003-elrs-on-telem1-as-built.md).
