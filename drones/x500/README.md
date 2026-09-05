---
tier: reference
domain: drones
---

# Holybro X500 V2

500 mm-class quadcopter development platform — the standard PX4 / ArduPilot autonomy airframe.
Intended for GPS-guided / offboard / ROS·MAVROS work rather than FPV freestyle.

## Kit spec

As purchased: **PX4 Development Kit — X500 v2**, Pixhawk 6C / M10 GPS / 915 MHz telemetry bundle.

| Item | Part | Notes |
|------|------|-------|
| Frame | X500 V2, 500 mm wheelbase carbon fiber | Body 144×144 mm, 2 mm plates; landing gear 215 mm; ~610 g |
| Motors | Holybro 2216 KV920 (×4) | 16×16 mm mount pattern |
| Props | 1045 (10×4.5) | |
| ESC | BLHeli S 20 A (×4) | |
| PDB | XT60 battery in, XT30 to ESCs/peripherals | |
| Flight controller | **Pixhawk 6C** | |
| GPS / compass | **M10** | |
| Telemetry | **915 MHz** radio | on **TELEM2** |
| RC receiver | RadioMaster RP3 ELRS (CRSF) | on **TELEM1**; bind phrase `dwdrones` ([rx setup](../docs/topics/elrs/rx-x500-rp3.md) · [pairing](../docs/topics/elrs/pairing-x500.md)); wired, **wiring not yet verified** (see ⚠ below) |
| Battery | OVONIC 4S 14.8V 4500mAh 50C (XT60) ×2 | ~18 min hover, no payload |
| Autopilot stack | **PX4** (dev kit) | ArduPilot also flashable |

Parts on hand & spares: [`inventory.md`](inventory.md).

## Payload — VLP-16 lidar

**Decided 2026-08-17: a single VLP-16 mount hanging below the airframe.** This replaces the
previously-assumed **RoboSense Airy** companion sensor, which is dropped — its price has not come
down, and import regulation makes it an awkward buy. The VLP-16 Lite is **already on hand** (it is
the sensor behind [`tools/point-cloud-visualizer`](../../tools/point-cloud-visualizer/docs/vlp16-getting-started.md)),
so this costs a printed/machined mount rather than a sensor.

Single mount, slung below the body — not a gimbal, not multi-sensor. Simplest thing that flies.

### What the swap actually changes

The Airy is a small, low-power, UART/Ethernet-ish companion sensor. The VLP-16 is a **spinning
mechanical puck with an interface box**, and that drags three requirements into the airframe:

| Requirement | Detail | Consequence for the X500 |
|---|---|---|
| **12 V rail** | The interface box takes 12 V and supplies both power and data to the sensor — Ethernet alone will *not* power it | Needs a 12 V BEC off the 4S pack; the PDB's XT30 taps are the feed point |
| **Ethernet (RJ45) out** | 100 Mbps point-to-point to a host NIC | The **6C has no Ethernet** (that's the 6X) — a companion computer with a real NIC is now mandatory, it is not optional plumbing |
| **Mass** | Vendor figure ≈590 g for Puck LITE (≈830 g for the standard Puck), *plus* the interface box and its cable | Material against an X500's payload budget — **weigh the actual unit + box + mount before trusting any AUW number** |

Details on wiring, the 12 V box, and host-side network setup are already written up in
[`vlp16-getting-started.md`](../../tools/point-cloud-visualizer/docs/vlp16-getting-started.md) —
that is the reference, don't re-derive it here.

### ⚠ Open items on the mount

- **Ground clearance.** Landing gear gives 215 mm from body to ground; the puck is ~72 mm tall
  (vendor spec) so a body-slung mount clears with room, but the mount depth eats into it. Measure
  before printing.
- **Landing gear in the scan.** The VLP-16 sweeps 360° horizontally with a ±15° vertical spread.
  Slung below the body, the four legs sit *inside* that swath and will show up as fixed returns on
  every frame. Either mount low enough that the legs fall outside the vertical FOV, or mask them in
  the point-cloud pipeline. Decide which before designing the bracket.
- **Vibration.** A spinning sensor rigidly bolted to a frame carrying 1045 props will smear
  returns. Soft-mount it, and expect to care about motion distortion — see
  [`lidar_motion_distortion.md`](../../embedded/sensor-transposition/docs/lidar_motion_distortion.md).
- **Companion computer not selected.** Needs an Ethernet NIC and enough throughput to take the
  100 Mbps stream. This is now on the critical path for the payload, where before it was a
  "sometime later" item.
- **CG.** A ~600 g mass hung below the body lowers CG (fine) but must sit on the vertical axis or it
  trims out as a permanent roll/pitch offset.

## Serial port wiring (Pixhawk 6C)

| Port | Device | Notes |
|------|--------|-------|
| TELEM1 | RadioMaster RP3 ELRS receiver (CRSF) | RC input |
| TELEM2 | 915 MHz telemetry radio | ground-station link |

> ⚠ **Verify the ELRS module wiring before buttoning up.** The RP3 TX/RX lines may be **swapped**
> against the Pixhawk TELEM1 UART — CRSF needs FC-TX → RX-RX and FC-RX → RX-TX (crossed). Confirm the
> pinout and that PX4 actually sees the receiver (link/CRSF frames on the port) before final
> assembly. Details + check procedure: [rx-x500-rp3.md](../docs/topics/elrs/rx-x500-rp3.md).

## Status

- [x] Assembled
- [x] Flight controller + firmware flashed (ArduCopter stable)
- [x] ~~Verify RP3 ELRS TX/RX wiring on TELEM1~~ — resolved; CRSF live on TELEM1
- [x] Radio / RC link bound (RP3 ELRS), calibration re-run and **saved** 2026-08-02
- [x] Compass calibrated on the bench; switch map applied (arm CH5 / mode CH6 / beeper CH7)
- [ ] Battery monitor calibrated against a meter (`BATT_CAPACITY` still 3300, packs are 4500)
- [ ] Throttle failsafe bench-tested
- [ ] GPS lock outdoors + compass re-check away from the bench
- [ ] First hover / maiden flight

Full bench-configuration record, including what is still outstanding:
[`web_bot_dump.md`](web_bot_dump.md).

### Payload (VLP-16)

- [x] **Sensor decided — VLP-16 Lite, single body-slung mount** (2026-08-17; Airy dropped)
- [ ] Weigh the puck + interface box + cable; redo the AUW/hover-current budget against it
- [ ] 12 V BEC sourced for the interface box (off the 4S pack via the PDB's XT30 taps)
- [ ] Companion computer selected — **must have an Ethernet NIC** (the 6C has none)
- [ ] Mount designed: clearance under 215 mm gear, legs out of the ±15° vertical FOV or masked
- [ ] Soft-mounting / vibration isolation for the spinning sensor
- [ ] Maiden flight flown **unloaded first** — do not debut the airframe with the payload on it

## Build & flight log

_Add dated entries as you go (assembly notes, PID tweaks, incidents, mods)._

- **2026-08-17** — **Lidar payload settled: a single VLP-16 mount hanging below the airframe.**
  The **RoboSense Airy is dropped** — its price hasn't come down and import regulation makes it an
  awkward buy, so the decision is to fly the VLP-16 Lite already on hand rather than wait on a
  purchase. The swap is not payload-neutral: the puck needs a **12 V rail** (its interface box
  powers the sensor; Ethernet does not), outputs **RJ45 Ethernet** the 6C cannot accept, and is
  roughly an order of magnitude heavier than the Airy. Net effect is that a companion computer with
  a NIC moves from "later" to **required**, and the AUW budget needs redoing against a weighed unit.
  Open mount questions recorded above — chiefly that the landing gear sits inside the sensor's
  vertical FOV.
- **2026-08-02** — Bench config revisited: radio calibration re-run and actually saved (the
  2026-07-25 snapshot still held `1100/1900` defaults), and the switch channel map applied — arm on
  CH5, mode on CH6, beeper on CH7 — shared with the CL35 off one cloned TX16S model. Full record in
  [`web_bot_dump.md`](web_bot_dump.md).
- **2026-07-25** — Bench configuration session: accel/compass/ESC calibration, motor mapping and
  port assignment verified. See [`web_bot_dump.md`](web_bot_dump.md).
- **2026-07-13** — Kit acquired (Pixhawk 6C / M10 / 915 MHz). Not yet assembled.

## Links

- Kit: <https://holybro.com/products/x500-v2-kits>
- PX4 build guide (Pixhawk 5X reference): <https://docs.px4.io/main/en/frames_multicopter/holybro_x500V2_pixhawk5x>
- Dev-kit docs: <https://docs.holybro.com/drone-development-kit/px4-development-kit-x500v2>
