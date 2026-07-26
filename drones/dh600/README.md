---
tier: reference
domain: drones
---

# DH600 — long-endurance folding cinematic platform

**Planned custom build.** A 600 mm-class folding carbon quad built around a big 6S pack and a
3-axis gimbal camera, aimed at **long flight times and cinematic / survey missions** rather than
agility. Largest craft in the domain and the first with a proper gimbal payload and a long-range
HD video + control link.

Status: **frame ordered; everything else still being refined.** Specs below are the intended build and
are settled on the major decisions — motors, props, power path, RC architecture, autopilot and gimbal
integration all have sourced numbers behind them. Remaining unknowns are vendor lookups, not choices
(see [open decisions](#-open-decisions-to-resolve-before-ordering)). Raw source list with prices:
[`parts_list.txt`](parts_list.txt).

## Concept

Lift-and-loiter, not freestyle:

- **600 mm folding airframe, 398 g** — packs to 235×185×65 mm, so the whole platform travels in a
  bag. Folding GPS mast and retractable landing gear keep the gimbal's view clear.
- **Low-KV 4110 motors on 15" props** — high thrust per watt at low disc loading, so hover sits at
  a small fraction of throttle and endurance comes from efficiency rather than raw pack size.
- **One large 6S pack** carries most of the AUW budget; the frame is rated to 3600 g all-up and the
  listing claims 35–45 min on a 6S 12000 mAh.
- **SIYI HM30 + A8 mini** gives long-range HD downlink and a stabilized, controllable camera — the
  actual mission payload. The HM30 also carries RC, which reshapes where the ELRS receiver lives
  (see [RC architecture](#rc-architecture)).

## Frame spec (DH600 folding kit)

Taken from the seller listing (see [Links](#links)); worth re-verifying on arrival.

| Parameter | Value |
|-----------|-------|
| Wheelbase | 600 mm |
| Folded size | 235 × 185 × 65 mm |
| Frame weight | 398 g (incl. landing gear, folding GPS mast, motor mounts, canopy) |
| Height | 135 mm (frame bottom to gear bottom) |
| Centre plate | 213 × 78 mm; sandwich 20 mm, upper bay 30 mm, bay length 160 mm |
| Rated AUW | 2600–3600 g |
| Recommended motors | 3510/380 KV or **4110/400 KV** |
| Recommended props | 1447 or **1555** |
| Recommended battery | 6S 10000 / 12000 / 16000 mAh, 10–15C |
| Claimed endurance | 35–45 min depending on config |

This build **matches the listing's recommended config #2 exactly** — *4110/400 KV motors, 1555 props,
40 A ESCs, 6S 12000 mAh, 3-axis gimbal, ≤3600 g, 40–45 min*. Motors, props, and ESC class all line up.

## Intended spec

| Item | Part | Notes |
|------|------|-------|
| Frame | DH600 carbon fiber folding quad kit, 600 mm | 398 g; full-fold arms/gear/GPS mast |
| Motors | **SunnySky X4110S 400 KV** (×4), 165 g ea | 45 A/30 s, 1125 W max; SunnySky specifies a **40–60 A ESC** |
| ESC | **Hobbywing XRotor 40 A, 3–6S** (×4), 50 g ea | 40 A cont / 60 A burst (10 s) — bottom of the recommended range |
| Props | **CF 1555** (15×5.5) ×4 | SunnySky's *first* listed prop for this motor; also a frame recommendation |
| Power module + distribution | **Holybro PM07** (90 A cont / 140 A burst, 2–14S), from the FC kit | B+ pads + PWM header feed the ESCs — **replaces the separate PDB**; 2× 5.2 V/3 A BEC |
| Battery connector | **AS150 + 8 AWG** (XT120 minimum) | replaces the shipped XT60 + 12 AWG — see below |
| Flight controller | **Pixhawk 6C** (full size), 59.3 g, 84.8×44×12.4 mm | kit includes **M10 GPS** + **PM07**; ~$300, cheaper than the 6C Mini bundle |
| FC mounting | Silicone bushings | vibration isolation for the 6C Mini |
| GPS / compass | **M10** (in FC kit) | on the frame's folding GPS mast |
| Video + datalink + RC | **SIYI HM30** | 5.1–5.825 GHz proprietary link; air unit outputs 16ch S.Bus + 5ch PWM |
| Camera / gimbal | **SIYI A8 mini** | 3-axis, 95 g, 55×55×70 mm; 11–25.2 V, 12 W peak / 5 W avg; native ArduPilot driver |
| Telemetry | SiK 915 MHz radio | on **TELEM2**; independent of the 5.8 GHz HM30 link |
| RC receiver | RadioMaster RP3 ELRS (CRSF/S.Bus) — *may swap to Gemini* | **lives at the ground station**, feeding the HM30 ground unit — see below |
| Battery | **6S LiPo**, 12000–16000 mAh, 10–15C | capacity TBD; its connector sets the power-module input pigtail |
| Autopilot stack | **ArduPilot** | settled; native SIYI gimbal driver (`MNT1_TYPE=8`) |

Parts on hand vs. still-to-buy: [`inventory.md`](inventory.md).

## RC architecture

**The HM30 air unit is not an ELRS receiver** — it will not talk to the TX16S directly. HM30 is
SIYI's own proprietary link on **5.1–5.825 GHz**, and the two halves only speak to each other. What it
*does* do is carry RC alongside video and telemetry: the air unit outputs **16 channels of S.Bus plus
5 channels of PWM** to the flight controller.

The catch is on the ground side. The HM30 ground unit has no sticks — it needs an RC signal fed into
its RC port, which accepts **S.Bus, PPM, or UART**. SIYI's compatibility note is the useful part: *any
transmitter that outputs S.Bus or PPM, **or whose receiver outputs S.Bus**, works.* So there are two
sane paths:

| | Path | Channels | Notes |
|---|------|----------|-------|
| **A** _(recommended)_ | TX16S →(ELRS 2.4)→ **RP3 at the ground station** →S.Bus→ HM30 ground unit →(HM30 5.8)→ air unit →S.Bus→ Pixhawk | 16 | RP3 rides in the backpack, not the aircraft. Full 16ch for gimbal/mode switches. This is SIYI's "RC relay" pattern. |
| **B** | TX16S trainer jack →PPM→ HM30 ground unit → … | ~8 | No receiver needed at all, but PPM caps you at ~8 channels and lower resolution. |

**Path A is the better fit** — the gimbal, camera triggers, flight modes, and gear retract will eat
channels fast, and 8 is tight. It also means the RP3 you already listed is *not* wasted; it just
moves off the airframe, saving weight and one antenna install.

Note the RP3 is **not** needed on the aircraft, and range is set by the HM30 link, not by ELRS.

If you want a genuinely redundant air-side RC link later, the good news is there's **no RF conflict**:
HM30 sits at 5.8 GHz and ELRS RP3 at 2.4 GHz, so a second ELRS receiver on the airframe would
coexist cleanly. That's a later addition, not needed for first flight.

## Power & endurance budget

Rough sizing to check the build closes inside the frame's 3600 g limit. **All figures are estimates
— verify against vendor data before ordering the pack.**

| Item | Mass | Source |
|------|------|--------|
| Frame kit | 398 g | vendor |
| Motors ×4 (X4110S, 165 g ea) | 660 g | SunnySky |
| ESCs ×4 (XRotor 40 A, 50 g ea) | 200 g | Hobbywing (as shipped, ~730 mm leads) |
| Props ×4 (1555 CF) | ~70 g | est |
| Pixhawk 6C | 59 g | Holybro |
| M10 GPS + mast mount | ~30 g | est |
| PM07 | ~30 g | est |
| SIYI HM30 air unit + antennas | ~94 g | SIYI (74 g excl. antennas) |
| SIYI A8 mini gimbal | ~95 g | SIYI |
| 12 V BEC for HM30 air unit | ~20 g | est |
| Wiring (8 AWG mains), connectors, hardware | ~120 g | est |
| **Dry subtotal** | **~1775 g** | |
| Tattu 6S 12000 mAh 15C (AS150) | 1619 g | Tattu |
| **Est. AUW** | **~3400 g** | |

**Where the mass actually goes:** battery 48 %, propulsion (motors/ESCs/props) 27 %, frame 12 %,
avionics ~7 %, and the actual payload — gimbal plus video link — only **~6 %**. A 600 mm airframe with
15" props and 40 min endurance is inherently a ~3.4 kg aircraft; the payload is not what makes it
heavy. The frame vendor's recommended config #2 is this exact parts list and they quote it at "3600 g
or less," so ~3400 g is on target rather than a warning sign.

**The 3600 g figure is a performance envelope, not a structural limit** — the listing also states a
*minimum* of 2600 g, which makes no sense as a strength rating. It's the mass band over which their
35–45 min claim holds. Thrust margin at 3400 g is ~3:1 (850 g/motor at hover ≈ 3.9 A against a motor
capable of ~2.5–3 kg thrust), comfortably above the 2:1 floor for safe multirotor flight.

### Current draw and endurance (from SunnySky's thrust table)

Manufacturer data for X4110S 400 KV on 15×5.5 at 22.2 V:

| Thrust/motor | Current | Power | Efficiency |
|--------------|---------|-------|------------|
| 500 g | 1.9 A | 42 W | 11.85 g/W |
| 750 g | 3.2 A | 71 W | 10.56 g/W |
| 1000 g | 4.9 A | 109 W | 9.19 g/W |
| 1250 g | 6.9 A | 153 W | 8.16 g/W |
| 1500 g | 9.2 A | 204 W | 7.34 g/W |

At ~3400 g AUW, hover is ~850 g/motor → **~3.9 A per motor, ~15.5 A total, ~344 W**. A 6S 12000 mAh
pack holds ~266 Wh; at 80 % usable that is **~37 min hover**, inside the frame listing's 35–45 min
claim. Hover sits at a small fraction of the ESC's 40 A rating, which is exactly the intent of a
low-KV / large-prop endurance platform.

**Pack size barely changes endurance**, because pack mass scales with pack energy and the two effects
nearly cancel. Masses other than the 12 Ah row are scaled from the Tattu data point (164 Wh/kg) and are
slightly optimistic for small packs, where connector/wire overhead is fixed:

| Pack | Pack mass | AUW | Hover/motor | Hover total | Endurance | Efficiency |
|------|-----------|-----|-------------|-------------|-----------|------------|
| 6S 5 Ah | ~680 g | ~2455 g | 614 g / 2.5 A | 10.0 A | ~24 min | ~11.2 g/W |
| 6S 6 Ah | ~810 g | ~2585 g | 646 g / 2.7 A | 10.6 A | ~27 min | ~11.0 g/W |
| 6S 8 Ah | ~1085 g | ~2860 g | 715 g / 3.0 A | 12.1 A | ~32 min | ~10.7 g/W |
| 6S 10 Ah | ~1350 g | ~3125 g | 782 g / 3.4 A | 13.7 A | ~35 min | ~10.4 g/W |
| **6S 12 Ah** | **1619 g** | **~3400 g** | **849 g / 3.9 A** | **15.5 A** | **~37 min** | **~10.0 g/W** |
| 6S 16 Ah | ~2160 g | ~3935 g | 984 g / 4.9 A | 19.4 A | ~40 min | ~9.3 g/W |

**2.4× the pack energy buys only 13 more minutes** (5 Ah → 12 Ah). Flying lighter is also genuinely
more efficient per gram — 11.2 vs 10.0 g/W straight from SunnySky's table — because efficiency drops as
the prop is loaded harder. Going 12 → 16 Ah buys ~3 min for 540 g and puts AUW ~335 g outside the vendor
envelope: a bad trade. **12 Ah is near the optimum for the endurance mission.**

Tattu ships the 12 Ah pack with **AS150 already fitted**, matching the connector chosen below, so only
the power-module side needs re-terminating.

### Small packs for shakedown and tuning

Plan to own **2× 6S 5–6 Ah** packs (~$60–90 each vs $270 for the 12 Ah) and fly the maiden hover, ESC
calibration, and PID tuning on those — 24–27 min is still a long flight, and it keeps the expensive pack
out of the riskiest sorties. Caveat: at ~2455 g you are below the frame's stated 2600 g minimum. That's
the soft end of an envelope, not a limit, but the airframe will feel floaty with 15" props on that little
mass and won't represent loaded handling — **do the final tune near real flying weight.**

### Charging

A 6S 12 Ah pack is **266 Wh**. The HOTA D6 Pro is 200 W on AC, so a full charge is ~1.5 h, and 1C
charging (12 A ≈ 266 W) exceeds what AC can deliver. A DC supply is needed to unlock the higher
per-channel rating for faster turnaround. **Confirm the D6 Pro's 6S handling and practical charge rate
before relying on it in the field.**

### Why 6S (and not higher)

Asked and closed 2026-07-26. **6S is set by the motors and ESCs, and higher voltage would gain
nothing here.**

| Part | Voltage limit |
|------|---------------|
| SunnySky X4110S 400 KV | **6S max** |
| Hobbywing XRotor 40 A | **3–6S (11.3–22.6 V)** |
| PM07 | 2–14S |
| A8 mini / HM30 air unit | on a BEC regardless |

The 14S ratings on the power modules are not an invitation — voltage tolerance is cheap (capacitor
ratings, regulator range) while current capacity is expensive (copper), so vendors make modules
voltage-permissive to serve the ag/heavy-lift market. See the power-module note below.

**Voltage is locked to KV and prop diameter.** 400 KV × 22.2 V = 8880 RPM, which is what a 15" prop
wants. At 12S the same motor would be asked for 17,760 RPM, destroying motor and prop. Going higher
voltage means a **~200 KV motor and new ESCs**, not a config change.

**And there is nothing to recover.** The case for high voltage is cutting I²R loss:

- Power path ≈ **0.6 mΩ** (~0.6 m of 8 AWG at 0.63 mΩ/m + ~0.2 mΩ for the AS150).
- At 15.5 A hover: **0.14 W lost of 344 W — 0.04 %**.
- At a 100 A transient: ~6 W of ~2200 W — 0.27 %.

Doubling voltage would save ~0.1 W. High voltage pays on 5–10 kW platforms pulling 200–400 A where
copper mass and resistive heating drive the design; at 2 kW peak this build is an order of magnitude
below that threshold. It would also cost more — new motors and ESCs, and the **HOTA D6 Pro tops out at
6S**, so a new charger too. The frame vendor lists only 6S packs; 6S is the correct voltage for a 15"
prop at this power, not a compromise.

### Worst-case current (design basis)

Hover is ~14 A, but the power path has to survive the extremes. The **ESC is the binding constraint**,
not the motor:

| Element | Continuous | Burst |
|---------|-----------|-------|
| X4110S 400 KV motor | 45 A / 30 s (1125 W) | — |
| **XRotor 40 A ESC** | **40 A** | **60 A (10 s)** |

So **60 A per motor is the theoretical maximum** and 40 A the sustained ceiling — giving **160 A
continuous / 240 A burst** four-up as the fault-bounded worst case. Realistic full-throttle draw with
this prop lands nearer 100–140 A total. Note SunnySky specifies a **40–60 A ESC** for this motor, so
the 40 A XRotor is at the bottom of the range: the ESC, not the motor, is what limits out at the
extreme.

### ⚠ Open decisions to resolve before ordering

- ~~**Power path.**~~ **Resolved 2026-07-26 — switched to the full-size Pixhawk 6C + PM07 bundle**
  (~$300, cheaper than the 6C Mini kit). The power module sits **in series ahead of everything**, so
  it sets the ceiling for the whole build:

  | Module | Continuous | Burst | Cells | Output | BEC |
  |--------|-----------|-------|-------|--------|-----|
  | PM02 V3 | 60 A | 100 A | 2–12S | XT60 | 1× 5.2 V/3 A |
  | PM06 V2 | 70 A | 120 A | 2–14S | B+ pads | 1× 5.2 V/3 A |
  | **PM07** | **90 A** | **140 A** | 2–14S | **B+ pads + PWM header** | **2× 5.2 V/3 A** |

  At ~25 A/motor, worst case ~100 A sits comfortably inside PM07's 140 A burst, and hover (20–25 A)
  is a quarter of its continuous rating. The 14S/90 A pairing looks odd but isn't: voltage rating is
  set by component breakdown (cheap — caps and regulator range), current rating by copper
  cross-section and I²R heat (expensive). At 14S, 90 A is ~4.7 kW; on 6S it's ~2 kW. High voltage
  exists precisely so a given power needs less current.

  Its B+ pads and PWM header make it the distribution board — solder the four ESC leads directly,
  **no separate PDB** (dropping both the Holybro 60 A board and the 200 A hub).

  **Decision: keep PM07 as shipped.** Against real flight currents it has large margin:

  | Regime | Total current | % of PM07 continuous |
  |--------|--------------|---------------------|
  | Hover (3400 g) | 15.5 A | 17 % |
  | Top of SunnySky's thrust table (1500 g/motor, ~1.8:1 T/W) | 36.8 A | 41 % |
  | Est. absolute full throttle, static | ~100–120 A | inside the 140 A **burst** |
  | ESC-bounded fault case | 160 A / 240 A | exceeds PM07 |

  The manufacturer's published thrust table doesn't reach a current that stresses PM07 — 9.2 A/motor is
  already a hard climb and totals only 37 A. The 160 A/240 A figure is a **fault bound, not a flight
  bound**: it is what flows if the ESCs pass their rated maximum because something jammed or shorted.
  Poor justification for the upgrade, because (a) in a jammed-prop scenario the aircraft is coming down
  regardless, (b) faults are near-always single-channel — one motor at 60 A plus three at hover is
  ~105 A, inside PM07's burst — and (c) four ESCs at max simultaneously is an arithmetic ceiling, not a
  failure mode.

  _Rejected:_ **PM08-CAN** (200 A/400 A) would add ~$100 **and** force the separate PDB back into the
  build (~$50 for the Holybro 300 A board) since PM08 is an inline sensor, not a distribution board —
  ~$150, 12 % of build cost, for margin never reached in flight. Revisit only if logged currents say
  otherwise.

  **Follow-up:** ArduPilot logs battery current — pull actual peaks from the first few flights and
  revisit with data if they land near 90 A.
- **Battery connector: AS150 (or XT120 minimum) — not XT90.** Holybro's
  [connector table](https://docs.holybro.com/power-module-and-pdb/power-module/connector-and-wire-rating),
  where "continuous" means 4 h at under 60 °C rise:

  | Connector | Wire | Continuous | Instantaneous |
  |-----------|------|-----------|---------------|
  | XT60 (as shipped) | 12 AWG | 30 A | 60 A |
  | XT90 | 10 AWG | 45 A | 90 A |
  | **XT120** | **8 AWG** | **60 A** | **120 A** |
  | **AS150** | **8 AWG** | **75 A** | **150 A** |
  | AS300 | 6 AWG | 150 A | 300 A |

  XT90 is too small once the optimistic hover figure is set aside — 90 A instantaneous doesn't cover a
  full-throttle punch. **XT120 is the minimum; AS150 is the pick** (same 8 AWG, more headroom for
  nothing). AS300 would be needed to cover the full 240 A ESC-bounded case, which is over-engineering:
  four motors at burst limit for 10 s simultaneously is a scenario where the connector isn't the
  problem. **Re-pigtail the power module to 8 AWG + AS150** regardless of which module is used.

  Keep the Holybro 60 A PDB as an X500 spare.
- ~~**Battery capacity.**~~ **Settled — 6S 12000 mAh 15C, Tattu-class, AS150.** Not a compromise: the
  endurance-vs-capacity curve is nearly flat (35 / 37 / 40 min for 10 / 12 / 16 Ah), so 16 Ah buys ~3
  min for 540 g and puts AUW outside the vendor envelope. 12 Ah is near the optimum. See
  [power & endurance](#current-draw-and-endurance-from-sunnyskys-thrust-table).
- **Confirm Path A vs Path B for the RC link** (see [RC architecture](#rc-architecture)). Path A is
  recommended; the decision determines whether the RP3 is installed at the ground station or the
  TX16S trainer jack is wired instead.
- ~~**Payload power rails.**~~ **Resolved — one 12 V rail feeds both payload devices.** The
  **HM30 air unit takes 11–16.8 V** and the **A8 mini 11–25.2 V at 12 W peak / 5 W average**, so a
  single **12 V/3 A BEC (36 W)** covers both: the A8 draws ~1 A, leaving ~2 A for the air unit. PM07's
  5.2 V rails cover the Pixhawk. Two notes: the A8 mini's 25.2 V ceiling is disputed (early lots and
  some retailer listings say 11–16.8 V) and a full 6S pack is *exactly* 25.2 V, so **don't run it
  direct off the pack** — the shared 12 V rail sidesteps batch variation entirely. Remaining unknown is
  the HM30 air unit's own current draw; confirm before finalising the BEC.
- ~~**Autopilot stack.**~~ **Settled: ArduPilot.** Native SIYI gimbal driver, better mission/mount
  handling than PX4 for this class of camera platform.
- ~~**Pixhawk 6C Mini port count.**~~ **Resolved 2026-07-26** — closes comfortably, and the X500's SiK
  915 MHz radio can come along. See [serial port wiring](#serial-port-wiring-pixhawk-6c-mini).

## Serial port wiring (Pixhawk 6C, full size)

**The port budget closes with room to spare** — the SiK 915 MHz radio from the X500 can stay.
Assumes RC Path A.

Two things make it fit: the **RC input is a dedicated port**, independent of the TELEM UARTs, and
**GPS2 is a real UART (UART8)** that can take any serial protocol. The full-size 6C gives 5 usable
UARTs (TELEM1/2/3 + GPS1/2) against the Mini's 4, plus a dedicated S.Bus output.

| Port | UART | Device | Notes |
|------|------|--------|-------|
| GPS1 | USART1 | M10 GPS / compass | from FC kit; port has the safety-switch pins |
| TELEM1 | UART7 | HM30 air unit — MAVLink telemetry | full flow control, 1.5 A limit |
| TELEM2 | UART5 | **SiK 915 MHz radio** | same role as on the X500 |
| TELEM3 | USART2 | A8 mini gimbal UART | **optional** — only for ArduPilot-side mount control |
| GPS2 | UART8 | spare | or air-side serial RC, see caveat below |
| RC IN | — | HM30 air unit S.Bus | via SIYI S.Bus Y cable, shared with the gimbal |
| S.Bus OUT | — | spare | dedicated output on the full-size board |
| CAN1 / CAN2 | — | spare | CAN1 if the power module is ever upgraded to PM08-CAN |
| I2C, 2× debug | — | spare | |
| Power 1 / Power 2 | — | PM07 on Power 1 | second analog input available for redundant supply |

**A8 mini topology (per SIYI):** video goes **A8 mini → air unit over Ethernet** (SIYI Gimbal-to-Link
cable) — it never touches the FC. Gimbal control comes off an **S.Bus Y cable** splitting the air
unit's S.Bus: one branch to the gimbal's quick-release control port, one to the FC's RC input. The
separate FC UART (TELEM3 above) is only needed for MAVLink mount control / ROI from ArduPilot rather
than driving the gimbal from the HM30 ground unit.

### ArduPilot gimbal config (A8 mini on TELEM3)

ArduPilot has a **native SIYI driver** — plain 3-wire UART (RX/TX/GND), and it translates MAVLink
gimbal and camera commands into SIYI's proprietary protocol, giving ROI, click-to-point and camera
triggering from Mission Planner.

| Parameter | Value |
|-----------|-------|
| `SERIALx_PROTOCOL` | 8 (SToRM32 Gimbal Serial) |
| `SERIALx_BAUD` | 115 (115200 bps) |
| `MNT1_TYPE` | 8 (Siyi) |
| `MNT1_RC_RATE` | 90 (deg/s, RC targeting speed) |
| `RC6_OPTION` / `RC7_OPTION` | 213 / 214 (mount pitch / yaw) |

> The ArduPilot docs use TELEM2 in their example; this build uses TELEM3, so **confirm the `SERIALx`
> index against the 6C's serial mapping in Mission Planner** rather than assuming. Two RC channels for
> pitch/yaw is trivial against the 16 available over HM30 S.Bus.

> ⚠ `MNT1_TYPE = 8` only exists on reasonably recent ArduPilot — "no MNT1 settings visible" is the
> classic symptom of firmware too old for the SIYI option. Flash current stable before debugging wiring.
> Docs: <https://ardupilot.org/copter/docs/common-siyi-zr10-gimbal.html>

> The ELRS receiver consumes **no FC ports** on Path A — it lives at the ground station feeding the
> HM30 ground unit, so the crossed-TX/RX CRSF gotcha from the X500 doesn't apply here.

> ⚠ **If you later want ELRS on the aircraft as a redundant link**, the constraint is not ports — the
> dedicated RC IN is already taken by HM30 S.Bus. ELRS can go on GPS2 as a serial RC input
> (ArduPilot `SERIALn_PROTOCOL=23`), but that leaves **two RC sources with no clean automatic
> failover** in either ArduPilot or PX4. Verify current firmware behaviour before planning a dual-link
> setup.

Why keep the SiK alongside HM30 telemetry: HM30 is 5.8 GHz and much more line-of-sight sensitive than
915 MHz, so the SiK link holds telemetry through obstructions and orientations where video drops — and
it works with the HM30 ground unit powered off. Two MAVLink links is a normal ArduPilot config.

## Status

- [x] **DH600 frame ordered** (2026-07-26)
- [ ] Order the full-size **6C + M10 + PM07** bundle (confirm PM07, not PM02/PM06)
- [ ] PM07 re-pigtailed: **8 AWG + AS150** in, ESC leads to B+ pads
- [ ] Post-maiden: check logged battery current peaks against PM07's 90 A / 140 A
- [ ] 6S 12 Ah pack ordered (Tattu-class, AS150, $270)
- [ ] 2× 6S 5–6 Ah shakedown packs for maiden / ESC cal / PID tuning
- [ ] Charger capability confirmed for 6S 12 Ah (D6 Pro is 200 W AC ≈ 1.5 h; DC supply for faster)
- [ ] RC path decided (A: RP3 at ground station, vs B: TX16S trainer PPM)
- [ ] **12 V/3 A BEC** sourced (feeds HM30 air unit + A8 mini); confirm air unit's current draw
- [ ] All parts ordered
- [ ] Airframe assembled + FC flashed with **current-stable ArduPilot** (needed for `MNT1_TYPE=8`)
- [ ] Motor/ESC direction + calibration
- [ ] HM30 link bound, RC relay working, A8 mini gimbal live on the bench
- [ ] GPS lock + compass calibrated
- [ ] Hover test + **measured** hover current / endurance
- [ ] First cinematic mission flight

## Build log

- **2026-07-26** — Parts list drafted (frame, X4110S 400 KV, XRotor 40 A, 1555 props, Pixhawk 6C Mini
  kit, HM30, A8 mini, RP3, Holybro PDB). Nothing ordered. Battery still unselected.
  Resolved: props are **1555**, matching the frame's recommended config; battery is a 6S LiPo with
  capacity still open. Two findings — the HM30 is a proprietary 5.8 GHz link rather than an ELRS
  receiver, so the RP3 belongs at the ground station feeding the HM30 ground unit over S.Bus; and the
  power path is connector-limited rather than copper-limited. Plan settled on **PM06 V2 re-pigtailed
  to 10 AWG + XT90**, using its B+ pads as the distribution point, which drops the separate PDB from
  the build. Est. AUW ~3050 g on a 12 Ah pack, inside the 3600 g frame rating.
- **2026-07-26** — FC port budget checked and closed: dedicated RC IN plus four usable UARTs
  (TELEM1/2, GPS1/2) means the **SiK 915 MHz radio stays**, and the A8 mini needs no FC port for video
  (Ethernet to the air unit) or basic control (S.Bus Y cable). CAN×2, I2C and the debug UART left
  spare. Only caveat recorded: an air-side ELRS backup link would contend for RC IN with no clean
  firmware failover.
- **2026-07-26** — **Switched FC to the full-size Pixhawk 6C + M10 + PM07 bundle** (~$300, ~$10 under
  the 6C Mini kit). Strictly better: PM07 is 90 A/140 A with 2× 5.2 V/3 A BEC and a PWM breakout
  (vs PM06's 70 A/120 A, one BEC), and the full board adds a 5th UART, a dedicated S.Bus output, and a
  second analog power input. Costs ~55 g and a larger footprint — both immaterial at ~500 g headroom on
  a 213×78 mm plate. Est. AUW revised to ~3100 g. XT60 re-pigtail still required.
- **2026-07-26** — Worked the current budget from manufacturer data instead of estimates. Findings:
  **1555 is SunnySky's own first-listed prop** for this motor (a vendor listing claiming 26 A / 12×3.8
  props was for a different KV — no over-propping issue). Hover is **~3.5 A/motor, ~14 A total**,
  well under my earlier 20–25 A guess, giving **~41 min** and confirming the frame's 40–45 min claim.
  Worst case is ESC-bounded at **40 A cont / 60 A burst per motor = 160 A / 240 A** four-up. Two
  consequences: the battery connector goes to **AS150 + 8 AWG** (XT90's 45 A/90 A is too small), and
  **PM07's 90 A/140 A no longer covers worst case** — PM08-CAN now recommended. Weight corrected with
  real figures (motors 165 g, ESCs 50 g) → AUW ~3200 g, which rules out the 16 Ah pack.
- **2026-07-26** — Audited the weight budget against vendor data after it looked implausibly close to
  the ceiling. Corrections: HM30 air unit is **74 g** (not ~110 g); a real Tattu 6S 12 Ah 15C is
  **1619 g** in AS150 trim (not ~1450 g). Net AUW **~3400 g** — matching the frame vendor's own quote
  of "3600 g or less" for this exact config. The mass is intrinsic, not payload: **battery 48 %,
  propulsion 27 %, frame 12 %, actual payload only ~6 %**. Also established that 3600 g is a
  performance envelope rather than a structural limit (the listing quotes a 2600 g *minimum* too), and
  that thrust margin is ~3:1. **Pack capacity settled at 12 Ah** — endurance is nearly flat across
  10/12/16 Ah (35/37/40 min) because mass scales with energy, so 16 Ah buys ~3 min for 540 g. New
  requirement found: HM30 air unit needs **11–16.8 V**, so a **12 V BEC** is required.
- **2026-07-26** — Tattu 12 Ah priced at **$270**; build total now ~$1300. Extended the endurance curve
  down to 5 Ah for a lower-weight-class option: 5 Ah → ~24 min at ~2455 g, and 2.4× the pack energy
  buys only 13 extra minutes overall. Plan is **2× 6S 5–6 Ah shakedown packs** (~$60–90 ea) for maiden
  flight, ESC calibration and PID tuning, with the final tune done near real flying weight since the
  light config sits below the frame's 2600 g minimum. Also flagged charging: a 266 Wh pack on a 200 W
  AC charger is ~1.5 h, so a DC supply may be wanted.
- **2026-07-26** — **Autopilot settled: ArduPilot.** Payload power resolved with it: A8 mini is
  11–25.2 V / 12 W peak / 5 W avg, HM30 air unit 11–16.8 V, so **one 12 V/3 A BEC feeds both**. Not
  running the A8 direct off 6S — its 25.2 V ceiling is disputed across batches and a full pack sits
  exactly there. ArduPilot has a **native SIYI driver** (`MNT1_TYPE=8`, `SERIALx_PROTOCOL=8` @115200)
  over a 3-wire UART, giving MAVLink ROI/click-to-point and camera triggering, so the gimbal
  integration is a solved path rather than an open question. Only caveat: the param needs recent
  firmware.
- **2026-07-26** — **PM07 kept; PM08-CAN rejected.** Checked real flight currents rather than the
  arithmetic ceiling: hover is 15.5 A (17 % of PM07's continuous) and the top of SunnySky's published
  thrust table is only 36.8 A (41 %). The 160 A/240 A figure driving the earlier PM08 recommendation is
  a **fault bound, not a flight bound** — and single-channel faults (one motor at 60 A + three at hover
  ≈ 105 A) stay inside PM07's burst. Upgrade would have cost ~$150 (PM08 ~$100 **plus** re-adding a
  ~$50 300 A PDB, since PM08 is an inline sensor with no distribution) for margin never reached. The
  **8 AWG + AS150 re-pigtail stays** — the XT60's 30 A continuous *is* exceeded in vigorous flight, so
  the connector was the real weak link all along, not the module. Will verify against logged current
  after the maiden flights.
- **2026-07-26** — Considered and rejected going above 6S. Hard-capped by the **X4110S (6S max)** and
  **XRotor 40 A (3–6S)**; the 14S ratings on the power modules are just cheap voltage tolerance, not a
  usable headroom. Voltage is locked to KV × prop diameter (400 KV × 22.2 V = 8880 RPM suits a 15"
  prop; 12S would demand 17,760 RPM), so higher voltage means new motors *and* ESCs. No efficiency case
  either: the power path is ~0.6 mΩ, so hover I²R loss is 0.14 W of 344 W (0.04 %). Would also need a
  new charger — the D6 Pro is 6S max. Recorded in [Why 6S](#why-6s-and-not-higher).
- **2026-07-26** — **Frame ordered.** Nothing else purchased yet; design continues to be refined
  against vendor data before committing to the electronics.

## Links

- Frame — DH600 CF folding quad kit (AliExpress): <https://www.aliexpress.us/item/2251832645328393.html>
- Motors — SunnySky X4110S 400 KV (AliExpress): <https://www.aliexpress.us/item/3256811369672356.html>
- ESC — Hobbywing XRotor 40 A 3–6S (AliExpress): <https://www.aliexpress.us/item/3256810401625172.html>
- Props — CF 1555 (AliExpress): <https://www.aliexpress.com/item/2251832769901052.html>
- FC — Pixhawk 6C Mini model B, incl. M10 GPS + power module (AliExpress): <https://www.aliexpress.us/item/3256812360792507.html>
- FC silicone bushings (AliExpress): <https://www.aliexpress.us/item/3256811997806516.html>
- PDB (AliExpress, Holybro 60 A — see concern above): <https://www.aliexpress.com/item/3256805647596698.html>
- Video/datalink — SIYI HM30 (AliExpress): <https://www.aliexpress.us/item/3256810236165659.html>
- Camera — SIYI A8 mini (AliExpress): <https://www.aliexpress.us/item/3256806472533602.html>
- RX — RadioMaster RP3 ELRS (AliExpress): <https://www.aliexpress.us/item/3256811780581682.html>

### Reference

- SIYI HM30 user manual (RC input modes, S.Bus/PPM/UART, RC relay): <https://siyi.biz/siyi_file/HM30/HM30%20User%20Manual%20v1.3.pdf>
- Holybro connector & wire rating table (XT60 = 30 A continuous): <https://docs.holybro.com/power-module-and-pdb/power-module/connector-and-wire-rating>
- Holybro PDB 60 A product page: <https://holybro.com/products/power-distribution-board-pdb>
- Holybro power module comparison: <https://docs.holybro.com/power-module-and-pdb/power-module-comparison>
