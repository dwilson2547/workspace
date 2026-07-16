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

- [ ] Assembled
- [ ] Flight controller + firmware flashed
- [ ] **Verify RP3 ELRS TX/RX wiring on TELEM1 (possible swap)**
- [ ] Radio / RC link bound (RP3 ELRS)
- [ ] GPS lock + compass calibrated
- [ ] First hover / maiden flight

## Build & flight log

_Add dated entries as you go (assembly notes, PID tweaks, incidents, mods)._

- **2026-07-13** — Kit acquired (Pixhawk 6C / M10 / 915 MHz). Not yet assembled.

## Links

- Kit: <https://holybro.com/products/x500-v2-kits>
- PX4 build guide (Pixhawk 5X reference): <https://docs.px4.io/main/en/frames_multicopter/holybro_x500V2_pixhawk5x>
- Dev-kit docs: <https://docs.holybro.com/drone-development-kit/px4-development-kit-x500v2>
