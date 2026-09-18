# 0001 — RC relayed through the HM30 (RP3 at the ground station)

**Status:** superseded by 0002 · **Date:** 2026-07-26 · recorded retroactively 2026-09-17 from
commit `b049983`

## Context

The SIYI HM30 air unit outputs 16 ch S.Bus, and SIYI's compatibility note says any receiver that
outputs S.Bus works into the ground unit. The build had one RC input to fill and a gimbal to
control.

## Options

- **A. RC relay.** TX16S → ELRS → RP3 *at the ground station* → S.Bus → HM30 ground unit → 5.8 GHz
  → air unit → S.Bus → Pixhawk RC IN, with an S.Bus Y cable to the gimbal.
- B. ELRS receiver on the aircraft, HM30 for video and telemetry only.

## Decision

Option A. RC IN is taken by the HM30 S.Bus; ELRS "can go on GPS2 as a serial RC input" was noted
as a caveat, not chosen.

## Consequences

- Control range becomes the HM30's range, and control dies with video.
- Superseded the same day by [0002](0002-elrs-direct-crsf-on-gps2.md). The README keeps the
  rationale under "Rejected: RC through the HM30".
