---
title: Never configure against unverified doc values — build docs mark verified vs planned
date: 2026-09-17
tags: hallucination,provenance,documentation,convention,ardupilot
domains: embedded,robotics
source: drones/docs/issues/2026_09_17_agent_invented_hardware_specs.md
---

Agents have repeatedly invented port/channel assignments to fill gaps in build docs, and later sessions configured against them as fact (fleet-wide issue 2026-09-17). Any wiring/channel/config table carries a ✅ verified / ⬜ planned status column; unknowns are marked ⚠ unverified, never filled from a 'typical' setup. Agents never upgrade a claim's status without a measurement, a param dump, or the user's word.
