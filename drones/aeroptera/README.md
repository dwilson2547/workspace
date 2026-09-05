---
tier: reference
domain: drones
---

# Aeroptera Lace II "Aero"

**Under consideration — nothing ordered.** An **800 mm, 3D-printed, folding quadcopter** frame,
released free (STL / STEP / 3DM) by **Aeroptera**, a student group building "innovative 3D printed
professional drone platforms," in collaboration with **Polymaker**. Documentation is a **48-page
user manual** (v2.1) covering materials, print profiles, hardware compatibility and assembly.

Status: **evaluating.** The design files and manual are downloaded and summarised here.

## ⚠ This is a much bigger aircraft than "3D printed frame" suggests

Correcting the initial read — this is not a printable freestyle frame. It is a **5 kg-class
professional platform**, physically **larger than the [DH600](../dh600/README.md)**:

| Parameter | Lace II "Aero" | DH600 (for comparison) |
|---|---|---|
| Frame size | **800 mm** | 600 mm |
| Reference weight | **3 kg** | — |
| Takeoff weight | **>5 kg** | ~3.4 kg |
| Payload capacity | **>1.5 kg** | ~190 g (gimbal + link) |
| Props | up to **15"**, 13.5" recommended | 15" (1555) |
| Folding | yes — "folds into a backpack" | yes |

Motor-to-motor diagonal is **800 mm**. Compatible with **at most 15 inch propellers**; the manual
recommends staying **under 13.5"** for polymer props, "to prevent damage to motor wirings due to
propeller deformation in severe turbulence or crash."

### The fleet-fit answer is much better than expected

The earlier concern was that this would duplicate the freestyle builds. It doesn't — **it parallels
the DH600, and shares its electronics**:

> "**Pixhawk 6C with Holybro PM07 are the only recommended flight control and power module
> combination for this aircraft.** This is because of the limited internal space."

That is *exactly* the DH600's FC and power module. The reference build also uses **Hobbywing X-Rotor
40 A ESCs (×4)** — again identical to the DH600 — and a **Holybro M10 GPS**. So the entire
autopilot, power-module and ESC knowledge base from the DH600 transfers directly, and there is a
dedicated printed part (`XE6C`) that stacks the 6C on top of the PM07 to fit the bay.

⚠ **The catch is that the 6C+PM07 pairing is mandatory, not preferred** — the internal volume is
built around it. Any other stack requires measuring the bay yourself.

## Reference build (from the manual)

| System | Part |
|---|---|
| Flight controller | **Holybro Pixhawk 6C** (PX4 + QGroundControl) |
| Power | **Holybro PM07** Power Manager (power module + distribution, 2-in-1) |
| GPS | **Holybro M10** |
| ESC | **Hobbywing X-Rotor 40 A** ×4 |
| Motors | **SunnySky V-Series V3506 KV650** ×4 |
| Props | **SunnySky EOLO 13.5×5 foldable** ×4 |
| Battery | **HRB 4S 4500 mAh 100C ×2** — ⚠ **dual-battery, a pair required per flight** |
| Controller / video | *Skydroid H12 Pro* controller + video TX/RX, Skydroid 2K single-axis gimbal camera |

⚠ **The manual explicitly disclaims the Skydroid video link:** *"we are unable to verify the function
of the video transmission system, because the unit we received was flawed… users are asked to select
their own based on availability or prior experience."* So the video/control link is an open choice,
not a validated one — which is convenient, since the [SIYI HM30 already
owned](../dh600/README.md#siyi-stack--whats-actually-owned) would be a candidate.

### The battery spec is already in the workshop

The manual recommends **two 4S 4500 mAh packs with XT60 connectors**, and the
[X500 owns exactly that](../x500/inventory.md): OVONIC 4S 14.8 V 4500 mAh, XT60, ×2. Different C
rating (50C on hand vs 100C recommended) and they'd be committed to one aircraft at a time, but the
form factor question is answered.

Battery bay dimensions, which are the binding constraint:

- Two-battery space: **45 × 148 × 62 mm**
- Each individual pack must be **under 45 × 148 × 31 mm**
- AE07 extended battery case: 145 × 45 × 37 mm
- Quick-release: press the button after disconnecting, pull to slide the module out

## Materials and printing

**This is the gate on the build**, and the manual is specific. Correcting an earlier assumption:
**CF-nylon is not the answer here, and for the structural clamps it is explicitly forbidden.**

### Global print settings (all components)

| Setting | Value |
|---|---|
| Infill density | **20–25 %** |
| Infill pattern | **Grid / Gyroid** |
| Support | **Tree** |
| Layer height | **0.2 mm** |
| Nozzle | **0.4 mm hardened steel** |
| Build plate | textured or smooth |

**Strength comes from wall loops, not infill:** *"Rather than raising infill density to 100 %, users
are encouraged to increase wall loops to the maximum count to achieve a solid part."* Components
listed at 100 wall loops are meant to be solid.

### ⚠ Superclamp / motor mountings (AE11–AE14) — the safety-critical parts

> "This part requires materials of very specific physical characteristics… we **exclusively recommend
> PETG-rCF08** for AE11, AE12, AE13, and AE14. Using any other material may increase risks of
> **slippage or detachment of the drone's arm during flight**. Please note that this part **must not
> be printed with materials with a stiffness profile equivalent to or stronger than PA (Nylon)**.
> Overly stiff materials can cause fractures and part failures that can be extremely dangerous.
> Materials that deform easily, like PLA, should also not be used."

So the window is narrow and deliberate: **not nylon (too stiff, fractures), not PLA (creeps under
repeated use), PETG-rCF08 only.** This is the single most important line in the manual.

### Recommended materials (Polymaker)

- **Polymaker Panchroma PLA**
- **Polymaker Fiberon PA612-CF15**
- **Polymaker Fiberon PETG-rCF08**
- **Polymaker Fiberon PETG-ESD**

### Per-component material and wall loops

| Part(s) | Material | Wall loops |
|---|---|---|
| AE01, AE02 | Fiberon PETG-rCF08 **or** Panchroma PLA | 6 · or 100 (solid) respectively |
| AE03 | Fiberon PETG-rCF08 or Panchroma PLA | 6 |
| AE04A, AE04C | Fiberon PETG-rCF08 or Panchroma PLA | 4 |
| AE04B | Fiberon PA612-CF15 or PETG-rCF08 or PETG-ESD | 4 |
| AE05A, AE05B | Fiberon PETG-ESD or Panchroma PLA | 4 |
| AE06 | Panchroma PLA or Fiberon PETG-ESD | 4 |
| AE07A, AE07B | Panchroma PLA or Fiberon PETG-ESD | 4 |
| AE08 | Fiberon PETG-rCF08 | ≥6 (depends on attachment weight) |
| AE09 | Fiberon PA612-CF15 or PETG-rCF08 | 100 (solid) |
| AE10 | Fiberon PETG-rCF08 or Panchroma PLA | 4 |
| **AE11, AE12, AE13, AE14** | **Fiberon PETG-rCF08 ONLY** — *"for safety reasons, do not use PA612"* | **100 (solid)** |
| AE15 | Panchroma PLA | 100 |
| AE16, AE17 | Panchroma PLA | 6–100 |
| **XE6C** | Fiberon **PETG-ESD** or PETG-rCF08 | — |

_XE6C note: it contacts the flight control and distribution board, and **PETG-ESD reduces static
buildup to protect core instruments against risk of static discharge.** Worth respecting._

### Diagonal printing — and the Bambu profile

The main frames (**AE01, AE02, AE03**) are designed to print **at an angle**, which "improves
strength and considerably reduces printing time." AE01 has a suitable tangent face; **AE02 and AE03
need a forced angle** — rotate 25–45° in the side view so only an edge touches the plate, then
manually draw small supports along the bottom, plus brim to stop the part detaching.

The **sliced `.3mf` files** are provided for AE01/AE02/AE03 and are the "Bambu print profile":

⚠ **They are sliced for Bambu Lab's A1** and intended to be opened in Bambu Studio. If the printer
isn't an A1, treat them as a reference for the diagonal orientation rather than a press-print — and
note the **0.4 mm hardened steel nozzle** requirement, since PETG-rCF08 and PA612-CF15 are both
abrasive.

## Additional materials needed

| Item | Detail |
|---|---|
| **M3 screws and nuts kit** | 6–30 mm lengths; **at least 40 × M3×25 mm**. ⚠ **Not self-tapping** — all holes are for regular threaded M3. **Nylock nuts not recommended** |
| **Carbon fiber tubes ×4** | Custom **16 × 13 × 220 mm** (outer × inner × length). Longer tubes needed for props over 15" — *untested by Aeroptera, proceed with caution* |
| **Screw glue** | **Required** — prevents screws near the motors loosening from vibration |
| **Nano tape** | Double-sided, for securing parts and dampening |
| **XT60 splitter + extension cable** | ~20 cm, to bring the PM07 XT60 out to the exterior |
| Soldering iron | Required to complete the reference model |
| Zip ties, duct tape | Cable fixing and insulation |
| Extension cables w/ bullet connectors | Only if motors have short leads — **not needed with SunnySky V3506** |
| 4S balance connector cable | Optional; balancing is awkward once the AE07 case is assembled |
| Electric screwdriver + hex wrench | Strongly recommended |

Screw hole convention: **2.9 mm** creates strong threads, **3.0 mm** creates threads, **3.2 mm** is
a bypass. Folding uses a **25 mm M3 screw with a nylock hex nut** as the rotational axis, and a
**25 mm M3 thumb screw** to lock the arm in flight — removed to fold.

## Optional / experimental parts

Experimental parts use an **`XE`** prefix instead of `AE`.

- **`XE6C`** — *required* if using Pixhawk 6C + PM07 (i.e. required here). Stacks the FC on the power
  distribution board to save space. The one `XE` part that isn't optional.
- **`XE13-C` / `XE14-C`** — canted motor mountings giving **5° inward horizontal cant** toward the
  centre of mass. Theoretically improves the stabilisation loop and increases yaw authority. Published
  as optional because of "technical difficulties on the software level and the strict requirements
  for alignment during assembly." Print two of each (A and B); the (1,2)/(3,4) numbering follows
  **PX4 quadcopter motor numbering**, and the `/` or `\` marks must match the arm orientation.
  ⚠ **Advanced users only** — the manual is explicit that these need flight-software tuning knowledge.
- **`XEGP`** — gimbal protector, attaches to AE08. **"Entirely experimental and has not been tested
  by us for effectiveness and reliability."**

## ⚠ Open decisions

- **Is this a build you want, or a print you want?** It's a 5 kg, 800 mm, dual-4S professional
  platform — a serious aircraft with a serious parts cost on top of the free frame. It overlaps the
  DH600's role (folding camera platform) more than it fills a gap, though at a different size class
  and with a much larger payload budget (>1.5 kg vs ~190 g).
- **Filament cost and print time.** 28 STL parts, several large and solid-walled, in Polymaker
  Fiberon materials. Work out the real filament quantity before treating "free frame" as cheap.
- **Printer capability** — 0.4 mm hardened steel nozzle, and drying for the CF-filled materials.
- **Autopilot stack.** The manual is PX4/QGroundControl-based but notes the 6C "supports the flashing
  of other software, such as ardupilot, based on personal preference." The DH600 settled on ArduPilot
  — same choice would apply here and would reuse that work.
- **Video/control link** — genuinely open, since the manual disclaims its own Skydroid recommendation.
- **Dual-battery logistics.** Every flight needs a matched pair. That's two packs to charge, balance
  and retire together.

## Status

- [x] Source, manual and design files located and read (2026-08-17)
- [ ] Decide go / no-go against the DH600's overlapping role
- [ ] Cost the filament: quantity × Polymaker Fiberon pricing, plus print hours
- [ ] Confirm printer has a **0.4 mm hardened steel nozzle** and filament drying
- [ ] Confirm whether the A1-sliced `.3mf` files suit the printer on hand
- [ ] Source materials — **PETG-rCF08 is non-negotiable for AE11–AE14**
- [ ] Order the 4× **16×13×220 mm** CF tubes
- [ ] M3 hardware kit (≥40× M3×25, non-self-tapping, no nylocks except the folding axis)
- [ ] Print the frame
- [ ] Electronics: 6C + PM07 + M10 (+ `XE6C` bridge), ESCs, motors, props
- [ ] Decide the video/control link
- [ ] Assemble

## Build log

- **2026-08-17** — Recorded as a candidate and **substantially re-scoped after reading the manual.**
  This is not a small printable frame: **Lace II "Aero" is an 800 mm folding quadcopter, 3 kg
  reference / >5 kg takeoff / >1.5 kg payload**, running up to 15" props — bigger than the DH600.
  Best finding: **Pixhawk 6C + Holybro PM07 is the only recommended stack** (there's a dedicated
  `XE6C` printed bridge for it) and the reference build uses **Hobbywing X-Rotor 40 A ESCs** and a
  **Holybro M10** — all identical to the DH600, so that electronics knowledge transfers whole. The
  recommended battery (2× 4S 4500 mAh XT60) also matches packs already owned for the X500. Materials
  question answered and it **contradicts the general assumption**: the safety-critical superclamps and
  motor mounts (AE11–AE14) must be **PETG-rCF08 only** — explicitly *not* nylon (too stiff, fractures)
  and *not* PLA (creeps). The "Bambu profile" is sliced `.3mf` files for AE01–AE03 **targeting the
  A1** specifically. Nothing ordered; the gate is now cost and role, not information.

## Links

- **Project / downloads** — Aeroptera Lace II "Aero": <https://aeroptera.xyz/aero/>
- **Design files + manual** (Google Drive, "Lace II Aero Launch (Release Version)"):
  <https://drive.google.com/drive/folders/19wE2HiMpM_tG5de_xOI7Jf4PQMr0pt7q>
- Aeroptera: <https://aeroptera.xyz/> · contact **TeamAeroptera@gmail.com** (they will email files
  directly if Drive is inaccessible)
- Sponsor / materials — Polymaker (Panchroma, Fiberon lines)

### Download manifest

**28 STL parts + `Lace II "Aero" User Manual.pdf`**, plus a subfolder of design files (STEP / 3DM).

`AE01_Frontal_Frame` · `AE02_Rear_Frame` · `AE03_Shield_Frame` · `AE4A_VT_Bracket` ·
`AE4B_VT_Plate` · `AE4C_VT_Cover` · `AE05A_Central_Skeleton` · `AE5B_Sliding_Lid` ·
`AE06_Battery_Rails` · `AE7A_Battery_Case` · `AE7B_Battery_Case` · `AE08_Mounting_Plate` ·
`AE09_Core_Plate` · `AE10_Backplate` · `AE11_Superclamp_L` · `AE12_Superclamp_R` ·
`AE13_Motor_Mounting_UP` · `AE14_Motor_Mounting_DOWN` · `AE15_Landing_Gear_Adapter` ·
`AE16_Landing_Gear_Long` · `AE17_Landing_Gear_Short`

Experimental: `XE6C_Flight_Control_Bridge_Pixhawk_6C` · `XE6C_PM07_Plate` ·
`XE13-C_Canted_Motor_Mounting_A(1,2) V2` · `XE13-C_Canted_Motor_Mounting_B(3,4) V2` ·
`XE14-C_Canted_Motor_Mounting_A(1,2) V2` · `XE14-C_Canted_Motor_Mounting_B(3,4) V2` ·
`XEGP_Gimbal_Protector`

### Related

- **Lace-Veyric** — Aeroptera's first public frame (Spring 2025). Shares most of the architecture;
  parts are prefixed `R` instead of `A`. The Aero manual reuses parts of the Veyric assembly
  instructions, so the Veyric manual is worth having for detail — but note **AE02/AE03 (Veyric
  R2/R3) are now printed diagonally**, so those graphics in the older manual are out of date.
