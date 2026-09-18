---
kind: requirement
status: open
date: 2026-09-17T23:51:31-04:00
source: README.md#range-budget--video-fails-before-control
---

# 0004 — The control link must outlast the video link

## What

Loss of the HM30 video and telemetry link must never take the RC link with it. Control has to
reach further than video at every point in the flight envelope.

## Why

This is the requirement behind every RC decision on the build: it is why
[0001](0001-rc-relay-through-hm30.md) (RC relayed through the HM30) was rejected the same day
it was written, and why [0002](0002-elrs-direct-crsf-on-gps2.md) and
[0003](0003-elrs-on-telem1-as-built.md) put the ELRS receiver on the aircraft. Stated in the
README under "Range budget — video fails before control"; recorded here as a node on 2026-09-17.

## Done when

An ELRS link margin is measured at a range beyond where HM30 video degrades, on this aircraft,
with the antennas as installed. Bench binding on 2026-09-17 is not that measurement.
