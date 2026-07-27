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
  bag. Folding GPS mast and folding landing gear — note the gear is **manual** on the base kit, so it
  stays down in flight and will appear in wide/low shots (electric retract is an add-on option).
- **Low-KV 4110 motors on 15" props** — high thrust per watt at low disc loading, so hover sits at
  a small fraction of throttle and endurance comes from efficiency rather than raw pack size.
- **One large 6S pack** carries most of the AUW budget; the frame is rated to 3600 g all-up and the
  listing claims 35–45 min on a 6S 12000 mAh.
- **SIYI HM30 + A8 mini** gives long-range HD downlink and a stabilized, controllable camera — the
  actual mission payload. RC stays off that link: **ELRS direct to the aircraft**, HM30 for video and
  telemetry only (see [RC architecture](#rc-architecture)).

### Why this airframe over a 7–9" long-range build

A 7–9" quad is cheaper and much cheaper to crash, but it's the wrong shape for a gimballed camera:

- **Prop-in-view** — a panning 3-axis gimbal needs props out of frame. 600 mm of wheelbase with the
  camera slung below the body keeps 15" props outside the shot; on a 7" they're in every wide frame.
- **Vibration** — ~4000 RPM on 15" props versus 15,000+ RPM on a 7". Gimbals and rolling-shutter
  sensors hate high-frequency vibration and soft-mounting only partly fixes it.
- **Clearance and mounting** — the A8 mini is 55×55×70 mm and must hang and pan freely. This frame has
  a purpose-built bay and 135 mm ground clearance; a freestyle frame has neither.
- **Payload fraction** — A8 mini + HM30 is ~190 g: 6 % of AUW here, ~13 % on a 1.5 kg 7".
- **Transport** — folded to 235×185×65 mm this is *smaller* than a rigid 9", which doesn't fold at all.

Accepted trade: at ~3.4 kg this is a camera platform, not a chase ship. It will not do anything
dynamic, which is consistent with the stated goal of long flights and cinematic missions.

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
| FC mounting | Silicone bushings | vibration isolation for the 6C |
| GPS / compass | **M10** (in FC kit) | on the frame's folding GPS mast |
| Video + telemetry | **SIYI HM30** | 5.1–5.825 GHz proprietary link; **not** used for RC on this build |
| Camera / gimbal | **SIYI A8 mini** | 3-axis, 95 g, 55×55×70 mm; 11–25.2 V, 12 W peak / 5 W avg; native ArduPilot driver |
| Telemetry | SiK 915 MHz radio | on **TELEM2**; independent of the 5.8 GHz HM30 link |
| RC link | RadioMaster RP3 ELRS (CRSF), dual-antenna diversity | **on the aircraft**, CRSF into GPS2; 16 ch, ~5 ms at 50 Hz, telemetry back to the TX16S |
| Battery | **6S LiPo 12000 mAh 15C** (Tattu-class, 1619 g) | settled — endurance curve is flat, 16 Ah buys ~3 min for 540 g |
| Autopilot stack | **ArduPilot** | settled; native SIYI gimbal driver (`MNT1_TYPE=8`) |

Parts on hand vs. still-to-buy: [`inventory.md`](inventory.md).

## RC architecture

**ELRS direct to the aircraft. The HM30 carries video and telemetry only.**

```text
TX16S ──ELRS 2.4GHz──> RP3 (on aircraft) ──CRSF──> Pixhawk 6C ──MAVLink──> A8 mini gimbal
A8 mini ──Ethernet──> HM30 air unit ──5.8GHz──> ground unit (video + telemetry)
                      HM30 air unit ──MAVLink──> TELEM1
```

Rationale: routing flight control through the video link is the wrong trade. SIYI publishes 150 ms for
HM30 video and **no RC latency figure at all**, and serialising an ELRS hop, S.Bus frame quantisation
and HM30 air time on top of each other adds delay for no benefit. Direct ELRS gives:

- **16 channels at ~5 ms**, with telemetry back to the radio (RSSI, battery, GPS on the TX screen)
- **RC on 2.4 GHz**, which propagates better than 5.8 GHz — and matters more at range than video does
- **Independent failure modes** — losing video no longer costs control
- No dual-RC-source problem: the HM30's S.Bus is simply not wired to the FC

Cost is ~20 g for the RP3 on the airframe and one antenna mount. There is **no RF conflict** — ELRS at
2.4 GHz and HM30 at 5.8 GHz coexist cleanly.

**The gimbal does not depend on the HM30 S.Bus.** On ArduPilot with the native SIYI driver over TELEM3,
gimbal pitch/yaw are RC6/RC7 arriving via ELRS and passed through as MAVLink mount commands. The SIYI
**S.Bus Y cable is therefore not needed** — one fewer cable than routing RC through the HM30.

### Rejected: RC through the HM30 ("RC relay")

The HM30 ground unit has no sticks; its RC port accepts **S.Bus, PPM, or UART**, and SIYI's pattern is
to feed it from your own transmitter or a receiver bound to it. Both variants were considered and
rejected:

| Variant | Channels | Why not |
|---------|----------|---------|
| TX16S **S.Bus out of the JR module bay** → HM30 | 16 | Viable — EdgeTX 2.10 merged module-bay S.Bus output, so the 8-channel limit is *not* real. But still puts RC on the 5.8 GHz link. Note open EdgeTX issues with module-bay PPM/S.Bus on 2.10.x. |
| TX16S **trainer jack PPM** → HM30 | ~8 | Lowest effort, but 8 channels and ~22 ms PPM framing. |
| **RP3 at the ground station** → S.Bus → HM30 | 16 | Chains two radio links in series to fly the aircraft. Rejected on latency and shared failure mode. |

Keep the first row in mind as a **fallback**: if ELRS ever proves problematic, the TX16S can drive the
HM30 directly at 16 channels without extra hardware.

### Range budget — video fails before control

Deliberate, and the safe ordering. **Set the ELRS packet rate to 50 Hz**: halving packet rate roughly
doubles range, 50 Hz reaches ~30 km, and 20 ms latency is irrelevant on a platform flying smooth
mission profiles. Free, and it buys more range than any hardware.

Two reasons RC outlasts video:

- **Path loss** — 2.4 GHz sees ~7.7 dB less free-space loss than 5.8 GHz at the same distance, plus
  better diffraction around obstacles.
- **Bitrate** — HM30 pushes 1080p60 (megabits); RC is a few hundred bytes/sec. High-bitrate links need
  far more SNR, so video degrades first.

Failure ordering is therefore: **video drops → control retained → ArduPilot RTL brings it home.** The
reverse would be the dangerous case, and keeping RC off the HM30 is what prevents it.

#### If more control-link margin is ever wanted

⚠ **Gemini is not a receiver swap.** It is a TX+RX scheme; the TX16S internal module is single-band
2.4 GHz, so a Gemini receiver alone does nothing. The real pairing is **RadioMaster Nomad** (dual 1 W
Gemini Xrossband JR-bay module) + **RadioMaster DBR4** (dual-band receiver) — two purchases, prices
unchecked. Gemini mode gives frequency diversity within a band; Xrossband runs 2.4 GHz and 868/915 MHz
simultaneously for genuinely independent paths.

⚠ **Xrossband collides with the SiK radio.** The 900 MHz half would sit inches from the 915 MHz SiK
telemetry link on TELEM2. One has to go — and since the HM30 already carries MAVLink telemetry, the
SiK is the natural casualty. Decide before buying.

Cheaper middle option: a **true-diversity receiver** (two antennas) protects against orientation nulls
rather than raw range, and works with the existing TX16S unchanged.

### Antenna installation

**Highest-leverage item on this build, and free.** A bad install costs 10–20 dB — more than the
difference between 50 Hz and 500 Hz packet rates. The casual approach used on the X500 (receiver
taped to the frame, antennas dangling) is fine there because short range leaves huge link margin; it
is not fine here.

**Carbon fiber is the dominant factor.** The DH600 is a full CF frame with a CF canopy, and carbon is
conductive — it blocks and reflects RF. **Every antenna must sit outside the carbon**, never inside
the body bay or under a plate.

**Five antennas, three transmitters.** Needs a placement plan, not opportunistic mounting:

| System | Antennas | Band | Role |
|--------|----------|------|------|
| RP3 ELRS | 2 (diversity, antenna switching) | 2.4 GHz | RX |
| HM30 air unit | 2 (5 dBi omni) | 5.8 GHz | TX |
| SiK radio | 1 | 915 MHz | TX |

Rules for this airframe:

- **Mount the RP3's two antennas orthogonally** — one vertical, one horizontal, or a 90° V. Parallel
  antennas hit the same null simultaneously and waste the diversity entirely. Cheapest available range
  improvement. (The RP3 is already a diversity receiver — no need to buy one.)
- **Respect the dipole null.** A dipole radiates in a toroid with near-zero output off its ends.
  Vertical antennas (hanging down off arms or gear legs) put the toroid on the horizon, where the
  ground station is at distance. An antenna pointed *at* the ground station is the failure case.
- **Separate the transmitters from the ELRS receiver.** HM30 and SiK both transmit inches away; a
  strong nearby transmitter desenses a receiver front-end via near-field coupling regardless of band
  separation. Use the 600 mm span.
- **Keep antennas and coax away from ESCs, motor phase wires and the 8 AWG mains** — all PWM switching
  noise sources.
- **U.FL is fragile.** No kinks or tight bends, strain-relieve the coax, don't coil excess near the
  antenna.
- **Fixed brackets, not tape** — printed mounts or tube clamps on the arms/gear. Antennas flapping in
  15" prop wash change the pattern in flight and fatigue the coax.

**Don't copy the 5" cluster pattern.** Clustering antennas at the rear is correct on a 5" build, where
the dominant failure mode is crashes and prop strikes and link margin is enormous at 300 m. It costs
three things that start mattering at range:

- **Mutual coupling** — at 2.4 GHz, λ = 125 mm, so antennas closer than ~λ/2 (62 mm) couple and distort
  each other's patterns. A 5" build is entirely inside that radius; a 600 mm airframe has no excuse.
- **Spatial diversity** — diversity has a polarization component *and* a spatial one. Clustered
  antennas see near-identical fading, keeping only half the benefit.
- **Body blocking** — a 5" cluster hides behind a small plate; here it would hide behind a large CF
  canopy and body bay.

**⚠ Mounting constraint: this airframe folds.** Arms and landing gear both articulate for transport.
The gear on the base kit is **manual** — electric retract is an add-on option, not included (the
listing's machine-translated text is ambiguous here; it reads as "electric *or* manual", with manual
being the default). Consequences:

- **Arm tips mean coax across a folding hinge** — U.FL plus repeated folding is a fatigue problem, and
  the arms fold every time the craft is packed, which is the whole point of the frame.
- **Gear legs are viable.** Because the gear is manual it cannot be cycled in flight, so its position
  is fixed while airborne and the antenna pattern is stable. Legs hang below the carbon, vertical,
  clear of the 15" props and the electronics bay. Only the transport fold flexes the coax — handle it
  with a service loop at the pivot.
- **Preferred anyway: short downward booms off the centre body**, below the canopy line. Less
  separation than arm tips, but nothing crosses a moving joint. Plan alongside the canopy layout since
  the booms need an anchor.

**⚠ Gimbal field of view constrains placement too.** On a camera platform, antennas must stay out of
shot. Note that manual gear stays **down for the whole flight** — clearing the shot is precisely why
camera aircraft have retracts — so wide panning and low-angle shots will show the legs, and anything
mounted on them. Check the A8 mini's yaw range against the planned mounting positions. Adding the
electric retract option later is worth considering for the footage, independent of the antennas.

#### 915 MHz (SiK) antenna

Worth upgrading from the stock stubby — the SiK's whole job is being the link that survives when the
5.8 GHz video drops, so a crippled backup is worthless. Candidate: **muzi works 17 cm 915 MHz whip**
(Meshtastic community standard). Their measured **SWR 1.3 vs 3.5 for a stock stubby** is the honest
figure: SWR 3.5 reflects 31 % of power back into the radio (−1.6 dB), SWR 1.3 reflects 1.7 %
(−0.07 dB). That's ~1.5 dB from matching alone, plus efficiency gains from being a real resonant
element (17 cm ≈ half-wave at 915 MHz, λ/2 = 164 mm). Realistically **3–6 dB total**; 6 dB doubles
range.

Ignore "10 dBi" on some listings — impossible at that length. A half-wave dipole is 2.15 dBi by
definition; this is ~2–3 dBi. The SWR measurement is the trustworthy number, not the gain claim.

- ⚠ **Won't fit hanging down.** The whip is 184 mm; the frame sits **135 mm** above ground, so a
  downward vertical mount extends past the gear contact point and gets crushed on landing. **Mount it
  pointing up on a mast** (the folding GPS mast is precedent) — the pattern is symmetric about the
  antenna axis and horizon coverage is what matters at range.
- ⚠ **Counterpoise.** It's an SMA-male whip designed to screw onto a Meshtastic node where the PCB and
  case form a ground plane. At ~0.56λ it's less ground-plane-dependent than a quarter-wave, but a
  **sleeve dipole** would be more predictable on a carbon boom.

**Ground side:** a 5.8 dBi 915 MHz collinear (already roof-mounted) is *not* excessive — collinears
gain by flattening the pattern to the horizon, and at 5 km / 120 m altitude the aircraft sits at a 1.4°
elevation angle, right in the strong lobe. Two caveats: it is weak **close and overhead** (200 m out,
100 m up = 27° elevation, well down the pattern), and it is fixed to the roof, so it only helps when
flying from home. **For field use, height and clear line of sight beat dBi** — get the antenna up on a
tripod and away from your body and vehicle; a human body is a significant 915 MHz absorber.

**Where the gain actually is: the ground station.** The aircraft must stay omnidirectional because it
banks and turns, so gain can't live there. The ground station roughly knows where the aircraft is, so
a **directional patch / helical / moxon** on the ground buys gain on both uplink and downlink. For
30 km work this is the standard move and is worth more than anything done on the airframe.

### Rejected: SIYI FM30

The **FM30** is a complete parallel radio system, not a bridge into the HM30: a 2.4 GHz JR-bay TX module
for the TX16S (30 km, 16 ch, 10 ms, Bluetooth FC config) paired with its own **FR / FR Mini receiver**
that mounts on the aircraft. Its partner is that receiver, not the HM30 ground unit. It would duplicate
what the RP3 already does for more money.

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
| RP3 ELRS receiver + antennas | ~20 g | est |
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
- ~~**RC path.**~~ **Settled — ELRS direct to the aircraft**, HM30 for video/telemetry only. Routing
  flight control through the video link was rejected on latency and shared failure mode. See
  [RC architecture](#rc-architecture).
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

**The port budget closes with room to spare.** The full-size 6C gives 5 usable UARTs (TELEM1/2/3 +
GPS1/2) plus a dedicated RC input and a dedicated S.Bus output.

| Port | UART | Device | Notes |
|------|------|--------|-------|
| GPS1 | USART1 | M10 GPS / compass | from FC kit; port has the safety-switch pins |
| TELEM1 | UART7 | HM30 air unit — MAVLink telemetry | full flow control, 1.5 A limit |
| TELEM2 | UART5 | **SiK 915 MHz radio** | same role as on the X500 |
| TELEM3 | USART2 | A8 mini gimbal UART | SIYI driver, `MNT1_TYPE=8` |
| GPS2 | UART8 | **RP3 ELRS (CRSF)** | `SERIALx_PROTOCOL=23` — CRSF gives telemetry back to the TX |
| RC IN | — | unused | available if the RP3 is run as S.Bus instead of CRSF |
| S.Bus OUT | — | spare | |
| CAN1 / CAN2 | — | spare | |
| I2C, 2× debug | — | spare | |
| Power 1 / Power 2 | — | PM07 on Power 1 | second analog input available for redundant supply |

> CRSF on GPS2 is preferred over S.Bus into RC IN because it is bidirectional — RSSI, battery and GPS
> come back to the TX16S screen. ⚠ CRSF wiring is crossed (FC-TX → RX-RX, FC-RX → RX-TX), the same
> gotcha flagged on the X500.

**A8 mini topology:** video goes **A8 mini → air unit over Ethernet** (SIYI Gimbal-to-Link cable) — it
never touches the FC. Gimbal control is **MAVLink over TELEM3**, driven by RC6/RC7 arriving via ELRS.
The SIYI **S.Bus Y cable is not needed** on this build.

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

> There is **only one RC source** on this build — the RP3 on GPS2. The HM30's S.Bus output is left
> unconnected, so the dual-RC-source failover problem never arises.

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
- [ ] RP3 bound to TX16S (phrase `dwdrones`), CRSF on GPS2, crossed TX/RX verified
- [ ] ELRS packet rate set to **50 Hz** for range (latency irrelevant on this platform)
- [ ] **Antenna placement planned** — 5 antennas, all outside the carbon, RP3 pair orthogonal, TX/RX
      separated (see [antenna installation](#antenna-installation))
- [ ] Antenna booms designed off the **centre body** (no coax across the folding arms); check nothing
      sits in the gimbal's field of view
- [ ] Decide whether to add the **electric retract** option — manual gear stays in shot
- [ ] Antenna brackets printed/fitted (no tape, no dangling)
- [ ] Consider a directional ground-station antenna for long-range sorties
- [ ] **12 V/3 A BEC** sourced (feeds HM30 air unit + A8 mini); confirm air unit's current draw
- [ ] All parts ordered
- [ ] Airframe assembled + FC flashed with **current-stable ArduPilot** (needed for `MNT1_TYPE=8`)
- [ ] Motor/ESC direction + calibration
- [ ] HM30 link bound (video + telemetry), A8 mini gimbal live on the bench via MAVLink
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
- **2026-07-26** — Looked at the **SIYI FM30** TX16S module and rejected it: it's a parallel 2.4 GHz
  radio system (JR-bay TX module + its own FR air-side receiver), not a bridge into the HM30 ground
  unit, so it would add an airborne receiver rather than remove one. Confirmed the HM30 air unit is
  already the only receiver on the airframe. Recorded the one real weakness it would have addressed —
  Path A carries RC on 5.8 GHz, so a link drop takes video and control together — as a
  review-after-flight item rather than a change.
- **2026-07-26** — **RC architecture reversed: ELRS goes direct to the aircraft; the HM30 carries video
  and telemetry only.** Routing flight control through the 5.8 GHz video link was the wrong trade — SIYI
  publishes no RC latency figure for HM30, and stacking an ELRS hop, S.Bus quantisation and HM30 air
  time adds delay for no gain. Direct ELRS gives 16 ch at ~5 ms with telemetry back to the TX, puts RC
  on 2.4 GHz (better propagation), and decouples video loss from control loss. Costs ~20 g for the RP3
  on the airframe. Also established the 8-channel limit was never real: **EdgeTX 2.10 supports S.Bus
  out of the TX16S module bay**, so TX16S → HM30 direct at 16 ch is a viable fallback if ELRS ever
  disappoints. Gimbal is unaffected — ArduPilot's SIYI driver over TELEM3 takes RC6/RC7 from ELRS, so
  the **S.Bus Y cable is dropped**. RP3 moves to GPS2 as CRSF; RC IN now unused.
- **2026-07-26** — Checked the range budget after asking whether the control link would out-range the
  camera. It's the other way round and that's the safe ordering: 2.4 GHz sees ~7.7 dB less path loss
  than 5.8 GHz, and the HM30's 1080p60 bitrate needs far more SNR than RC does, so **video fails first
  and RTL brings it home**. Action is free — run **ELRS at 50 Hz** (~30 km; halving packet rate roughly
  doubles range, and 20 ms latency is irrelevant here). Recorded that **Gemini is a TX+RX scheme, not a
  receiver swap** (needs Nomad module + DBR4), and that its Xrossband 900 MHz half would **collide with
  the 915 MHz SiK** on TELEM2.
- **2026-07-26** — Added an **antenna installation** section; it was missing and is the
  highest-leverage remaining item. A poor install costs 10–20 dB, more than any packet-rate change.
  Key points for this airframe: the frame is **full carbon and conductive**, so every antenna must sit
  outside it; there are **5 antennas and 3 transmitters** on one 600 mm craft, so TX/RX separation
  matters; and the **RP3 is already a diversity receiver** (dual T antennas, antenna switching), so its
  two antennas must be mounted **orthogonally** or the diversity is wasted. Also noted that
  long-range gain belongs on the **ground station** (directional patch/helical), since the aircraft has
  to stay omnidirectional.
- **2026-07-26** — Evaluated the **muzi works 17 cm 915 MHz whip** for the SiK. Worth it: their
  measured **SWR 1.3 vs 3.5** for a stock stubby is ~1.5 dB from matching alone, plus efficiency from
  being a real half-wave-ish radiator — call it 3–6 dB. ("10 dBi" listing claims are fiction at that
  length; a half-wave dipole is 2.15 dBi.) Two airframe catches recorded: at **184 mm it is longer than
  the 135 mm ground clearance**, so it must point *up* on a mast rather than hang down, and its
  counterpoise assumption (screwed to a node PCB) differs on a carbon boom. Existing **5.8 dBi roof
  collinear judged well-suited to long range** — the flattened pattern matches a 1.4° elevation angle
  at 5 km — but weak overhead and roof-fixed, so field work needs a portable mast where height and
  clear line of sight matter more than dBi.
- **2026-07-26** — Correction: the base frame kit's landing gear is **manual, not electric** — the
  listing's machine-translated text presents electric retract as an add-on ("the tripod loaded into
  electric… do not have electric retractable when fully manual retractable") and I had over-read it.
  Consequence for antennas is mildly favourable: manual gear can't be cycled in flight, so its position
  is fixed while airborne and **gear legs are a viable mounting spot** (only the transport fold flexes
  the coax, fixable with a service loop). The arm-hinge constraint is unchanged. New consequence for
  the mission: **gear stays down for the whole flight**, so it will be in frame on wide and low shots —
  worth evaluating the electric retract add-on for footage reasons, and worth checking the A8 mini's
  yaw range against any antenna placement.

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
