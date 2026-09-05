---
title: Thermal gimbals are export/import controlled — it blocks SAR drone builds
date: 2026-08-17
tags: sar,thermal,export-control,payload,siyi,planning
---

Considered a SAR drone (drop a flotation device over water, mark position for a rescue crew) built around a SIYI ZT6 dual-sensor gimbal. **Shelved 2026-08-17: not the price, the paperwork.**

A thermal camera is not optional for that mission — over open water, in the conditions that produce a rescue, a visual-spectrum sensor does not find a person. And the higher-tier thermal sensors that would actually do the job are **tightly export/import controlled**. Cheaper/lower-resolution thermal exists and moves more freely, but not at a capability that makes the mission work.

**The generalisable lesson: check regulatory availability of the payload before designing an airframe around it.** Sensor availability is a hard gate that sits upstream of every other decision — motors, frame, power, autopilot — and unlike price it does not soften over time. On this build the mission was defined by a payload that turned out to be unobtainable, which invalidated the whole concept rather than delaying it.

Same class of constraint took out the **RoboSense Airy** on the X500 (import regulation plus static pricing), which was resolved by falling back to a VLP-16 already on hand. Where a substitute exists, substitute; where the mission *is* the sensor, the mission is the thing that has to go.

The regulation itself is reasonable — the same capability that finds a person in the water tracks people and vehicles on land. Understanding why it exists does not make it less of a roadblock for hobby SAR work.
