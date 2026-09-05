---
tier: reference
domain: drones
---

# Reliant V2 — Y6 (F121)

**Built.** A **Y6** — three arms, six motors in coaxial pairs — on the open-source **"Reliant" V2**
frame by **eyefly**, cut to order by
[Cncmadness / cncdrones.com](https://cncdrones.com/reliant--long-range-y6.html) (part **F121**,
**$29**). Paired with an **HGLRC Specter 6-in-1 AIO**, which is what made the build possible.

Status: **assembled and wired (2026-09-01).** Motors, props, FC, RX, camera and printed parts are
all on. **Blocked on one part: the HDZero Whoop V2 VTX was destroyed** by pack voltage on the FC's
digital-video pad — replacement lands 2026-09-02. See
[the VTX failure](#-vtx-failure--the-video-power-pad-is-pack-voltage), which is the most important
thing on this page.

## ~~On the "sub-250 g" goal~~ — closed, it's a 4S build

**Resolved 2026-09-01: the aircraft runs 4S, so the sub-250 g target is off.** Recorded because the
rest of this page was written around that constraint and would otherwise read as live.

The designer's own stated build was always the long-range one, not a light one:

> "the frame is basically a Y6-version of the **#microlongrange**, so from my findings the **1404
> motors** fit best. I'm flying the Y6 with **3s Li-Ion packs using 4" props** … With the 3s Li-Ion i
> get flight times of around **16-20mins** (depending on if i got the GoPro on or not)."

The 1404 / 4" half of that carried over; the 3S Li-Ion half did not. cncdrones files the frame under
**4" frames**, and it is now a 4S LiPo aircraft — register it and fly it as such.

## Why a Y6

The designer's own rationale, which is the interesting part of this airframe:

> "I always loved the way a Y6 looks like. In theory **up to 2 motors / propellers can break (just
> not on the same arm), and you can still stay in the air**. Sadly it requires you to use a landing
> gear. However using this design with **90° flipped arms**, this is not the case."

So: six-motor redundancy without the landing gear a conventional Y6 needs, because the arms are
rotated 90°. Costs are the usual coaxial ones — the lower prop works in the upper's wash, so budget
worse hover efficiency than a flat hex of the same motors, and don't carry a quad-derived hover
figure into the weight budget.

⚠ **Expect it to fly differently.** From the reviews: *"It definitely has it's own flight character
having flown hexacopter and quads which all fly the same this thing is different and I like it"* —
and, more usefully, *"**Took a bit to tune the bobbles out** but flys well no complaints."* Plan on
tuning time rather than a clean maiden.

## Frame

| Parameter | Value |
|---|---|
| Design | **"Reliant" V2** by **eyefly** — open source, **CC BY-NC** |
| Vendor | Cncmadness (cncdrones.com), part **F121**, **US $29.00** |
| Availability | **Cut to order** — no stock; ~1–3 days to cut, then ship |
| Class | 4" props, Y6 |
| Arm height | **20 mm** (raised from 18 mm in V1, by request) |
| Fitment | V2 added a 0.1 mm offset per axis (0.2 mm total) — reviewers confirm **no filing needed**, where V1 needed some |
| Material | Carbon fiber (cut by vendor); TPU printed parts by you |

⚠ **The FC/ESC stack holes were moved 5 mm rearward in V2 for USB access** — the designer notes it is
*"still not perfect, but given the design thats the best it can get."* Expect awkward USB access and
plan for it (a USB-C extension or right-angle adapter) rather than being annoyed later. The Specter
ships with **2× USB-C adapters**, which may cover this.

## Spec

| Item | Part | Status |
|------|------|--------|
| Frame | **Reliant V2 (F121)**, cncdrones.com | **fitted** |
| Flight controller / ESC | **HGLRC Specter 6-in-1 AIO — F722 + 40 A ESC** | **fitted**, $99.99 |
| Motors | ×6 — **iFlight XING 1404 3800 KV** | **fitted** |
| Props | ×6 — **iFlight Nazgul T4030** (4×3.0, 2-blade, T-mount) | **fitted** |
| Battery | **4S LiPo** | **in use** — supersedes the designer's 3S Li-Ion |
| RC link | **RadioMaster RP3 ELRS**, bind phrase `dwdrones` | **fitted** |
| FPV antenna | **Cherry** (also on the [3" freestyle](../freestyle-3in/README.md)) | **fitted** |
| Video / FPV | **HDZero Whoop V2 VTX + HDZero Nano V3 camera** | ⛔ **VTX destroyed — replacement due 2026-09-02** |
| Printed parts | XT60 / capacitor / ELRS-antenna holder · landing gear | **printed and fitted** |
| Autopilot stack | **Betaflight** (`HGLRCF722AIO_X6` 4.4.3) — **ships defaulted to the Y6 mixer** | fitted |

Parts and hardware: [`inventory.md`](inventory.md).

## ⚠ VTX failure — the video power pad is pack voltage

**The HDZero Whoop V2 was killed by plugging a 4S pack into the FC.** Root cause is confirmed from
both vendors' own documentation, and it will repeat on the replacement unless the wiring changes.

| Side | Figure | Source |
|---|---|---|
| **HDZero Whoop V2 input range** | **3 – 12.6 V (1S–3S)** | [HDZero docs](https://docs.hd-zero.com/whoop-v2) |
| **Specter digital-video power pad** | **labelled `7.4–26.4 V`** — i.e. pack-referenced, unregulated | HGLRC Specter manual v1.0, wiring diagram |
| 4S pack, charged | **16.8 V** | — |

So the pad handed the VTX 16.8 V against a 12.6 V ceiling. Two further notes from the HDZero page:
the Whoop V2 has **no reverse-polarity protection**, and a capacitor is "strongly suggested" even at
3S — this is a part with very little margin designed into it.

**Why the CL35 got away with it.** The reasoning at the time — *"the MicoAir 743 gives it a regulated
12 V, so pack voltage shouldn't be an issue either"* — was half right. It correctly identified that
the two boards differ; what it missed is that **12 V was never comfortable headroom, it was 0.6 V
short of the ceiling.** The [CL35](../cinelog35-tof/README.md) runs the same VTX on the MicoAir
H743 v2 AIO's 12 V pin and is inside spec, but only just. The generalisable rule is that a "digital VTX"
pad on an AIO is **not a standard rail** — it is whatever that board's designer chose, ranging from
5 V to raw pack — so it has to be read off the manual per board, not carried across from the last
build.

### ✅ Fix — a Matek Micro BEC, on its own rail

**Resolved: a Matek Micro BEC (6–60 V → 5 V/9 V/12 V) was bought to power the replacement VTX.**
This is the right answer — it takes the VTX off the Specter's pack-voltage pad entirely rather than
relying on an unspecified onboard rail, and it brings protection the pad never had.

| Parameter | Matek Micro BEC |
|---|---|
| Input | **6 – 60 V** — 4S is nowhere near the limit |
| Output | **5 V default**; **9 V or 12 V by soldering the respective jumper** |
| Current | 5 V: 2.8 A @16 V in · **9 V: 2.6 A @16 V in** (3 A max) |
| Protection | **OCP with hiccup, thermal shutdown**, start-up ≥6.7 V |
| Size / weight | 18 × 15 × 4.5 mm, **2 g** |

#### ⚠ Set it to 5 V or 9 V. Do **not** solder the 12 V jumper.

This is the one way to get the fix wrong, and it's a single solder blob:

- **5 V — the factory default, requires no action.** In range, and HDZero's "≥1.5 A available on a
  5 V feed" requirement is comfortably met (2.8 A at 4S input).
- **9 V — one jumper.** Sits mid-window in the VTX's 3–12.6 V range with margin on both sides, and
  less current for the same power than 5 V. The best choice if you're soldering anything.
- **12 V — don't.** It is *in* spec, but only by 0.6 V — it would recreate exactly the
  no-margin situation the CL35 is already in, for no benefit, on the aircraft that just lost a VTX.

Also fit the capacitor HDZero recommends. The printed **XT60 / capacitor / ELRS-antenna holder**
already on the aircraft has a place for it.

⚠ **Do not re-solder to the `7.4–26.4 V` pad.** Nothing about the failure was a one-off.

## Flight controller — HGLRC Specter 6-in-1 AIO

The part that unblocked the build: a **6-output AIO**, which is rare in this class and is exactly what
a Y6 needs.

| Parameter | Value |
|---|---|
_Figures below are from the **official manual (v1.0)**, which is the authority where it disagrees
with the retail listing — the listing's 14 g is really **13.2 g**, and 26 V is really 26.1 V._

| Parameter | Value |
|---|---|
| Name | HGLRC SPECTER F722 40A 6-channel AIO |
| Price | **$99.99** (getfpv) |
| Size / mounting | **34 × 48 mm**, **25.5 × 25.5 mm M2** |
| **Weight** | **13.2 g** (manual) |
| MCU | STM32F722 |
| Gyro / baro | **ICM42688P** / DPS310 |
| Voltage | **8.4–26.1 V (2S–6S)** |
| ESC | **40 A max per channel**, 6 channels |
| FC firmware | **`HGLRCF722AIO_X6` 4.4.3** |
| ESC firmware | **Bluejay 0.19, 48 kHz** (`F-H-40`) |
| Blackbox | 16 MB |
| **UARTs** | **3** |
| **Digital-video power pad** | **`7.4–26.4 V` — pack voltage, unregulated.** A `5V` pad sits on the same header |
| BEC ratings | ⚠ **not published** — absent from both the manual and the product page |
| In the box | power connector, **2× USB-C adapters**, hardware set, wiring set, 4× grommets, capacitor |
| NDAA compliant | No |

Four things to plan around:

- **✅ It ships defaulted to the Y6 mixer.** From the manual: *"When using the flight control for the
  first time, the default mixed control setting of the flight control is Y6."* The mixer dropdown
  offers **Y6** and **HEX X** only. So the awkward part of a Y6 build — getting a six-output mix
  right — is the factory default here, which is presumably why HGLRC built the board.
- **⚠ Only 3 UARTs.** RX + VTX + GPS consumes all three. There is no room for a fourth serial device,
  so decide the peripheral set before wiring — this is a hard limit, not a tight one.
- **⚠ It ships a vendor-specific Betaflight target (`HGLRCF722AIO_X6`).** The Y6 six-output support
  lives in that target. Do not assume stock Betaflight, INAV or ArduPilot will run on it — check
  before planning anything that depends on another stack, and be careful about firmware updates.
- **⚠ The video power pad is raw pack voltage** — this is what destroyed the first VTX. See
  [above](#-vtx-failure--the-video-power-pad-is-pack-voltage).

40 A/channel is heavily oversized for 1404 motors, which pull single-digit amps. That costs nothing
here — the board is 13.2 g — but don't read the 40 A rating as a reason to fit bigger motors than
the frame wants.

## Motors and props — at the top of the motor's rated range

Recorded because both figures sit at a limit rather than in the middle of one.

Shared platform: the [Angel30 3" freestyle](../freestyle-3in/README.md) runs the same **iFlight XING
1404** at a higher KV. **Both were bought on Amazon for availability** rather than chosen on spec —
AliExpress lead time was ~a month — so read the KV as what was in stock, not a tuning decision.

| Parameter | iFlight XING 1404 3800 KV |
|---|---|
| Cell count | **2–4S** — so this build runs at its rated ceiling |
| Max continuous current | **11.8 A** |
| Max continuous power | **174.6 W** |
| Config / stator | 9N12P, 14 × 4 mm |
| Weight | 9.1 g incl. wire (**~55 g for six**) |

Two things worth a look after the first few packs, neither of them a reason to change anything:

- **3800 KV on a 4" prop at 4S is the aggressive end of iFlight's own pairing** — the 3800 KV is
  commonly listed against 3" props at this voltage. **Check motor temps by hand after the first
  pack**; a Y6 spreads the load over six motors, so per-motor loading is lower than the same
  motor/prop combination on a quad, which is the mitigating factor.
- **Shaft fit.** Nazgul T4030 is a **1.5 mm T-mount** prop. The original XING 1404 used a **1.2 mm**
  shaft and the **XING2 1404 uses 1.5 mm** — since the props went on, this is a 1.5 mm-shaft
  variant. Worth knowing when reordering: buy to the shaft, not to the name.

## ⚠ Open decisions

- ~~**How the replacement VTX gets its power.**~~ **Resolved — a Matek Micro BEC on its own rail.**
  The remaining action is a settings one: [5 V or 9 V, never 12 V](#-set-it-to-5-v-or-9-v-do-not-solder-the-12-v-jumper).
- **Measured AUW.** Never taken. Now that it's a 4S build the number is for registration and
  reference rather than for a target, but it's still unrecorded.
- **Motor temps** after the first packs — see [motors and props](#motors-and-props--at-the-top-of-the-motors-rated-range).
- **GPS.** Not fitted. There is a TPU GPS mount in the print files and the frame is a long-range
  design, but a GPS would consume the last of the three UARTs.

_Resolved: sub-250 g (abandoned — 4S build) · motors (XING 1404 3800 KV) · props (Nazgul T4030) ·
battery chemistry (4S LiPo, so the Li-Ion charge-profile question is moot) · video system (HDZero
Whoop V2 + Nano V3)._

## 3D printed parts

Two sources: the designer's TPU mounts, and two custom parts designed for this aircraft.

| Part | Source | Status |
|---|---|---|
| TPU camera mount | Thingiverse download | **printed + fitted** |
| TPU GPS mount | Thingiverse download | not needed — no GPS fitted |
| **XT60 / capacitor / ELRS-antenna holder** | **custom** | **printed + fitted** — one part carrying the power connector, the capacitor and the RP3's antenna |
| **Landing gear** | **custom** | **printed + fitted** |

The XT60/capacitor holder is worth noting against the
[VTX fix](#fix-before-plugging-the-replacement-in): HDZero recommends a capacitor on the Whoop V2's
supply, and this part already provides somewhere to put one.

Designer's print settings for the TPU mounts:

| Setting | Value |
|---|---|
| Printer used | Prusa i3 MK2S |
| Layer height | **0.2 mm** |
| Infill | **20 %** |
| Material | **TPU** |

## Hardware (from the designer's build notes)

The frame is sold as CF + hardware, but the designer's own list is worth having — note the **hint
that the 6 mm motor-plate standoffs are optional** (an M2×10 mm screw and bolt works; he uses the
spacers for easier alignment), and that **aluminium spacer bolts save meaningful weight**, which
matters here.

| Purpose | Hardware |
|---|---|
| Motor plates → arms | 12× **M2 6 mm spacer bolts**, 24× **M2 3 mm screws** |
| Arms → main plates | 6× **M2 18 mm spacer bolts**, 12× **M2 4 mm screws** (up to 6 mm ok) |
| TPU camera mount | 2× **M2 18 mm spacer bolts**, 4× **M2 4 mm screws** (up to 6 mm ok) |
| TPU GPS mount | 1× **M2 8 mm** (or 10 mm), 1× **M2 nut** |

Assembly note from the designer: motor plates push onto the arms, arms onto the main plates, secured
with spacer bolts that are *deliberately slightly shorter* than the frame parts, which is what makes
the joint tight.

## Status

- [x] Frame ordered (2026-08-17) — cut-to-order, ~1–3 days
- [x] Y6-capable AIO FC identified — **HGLRC Specter 6-in-1**
- [x] FC ordered and fitted
- [x] ~~Weight budget~~ — moot, it's a 4S build
- [x] Motors/props/battery selected — **XING 1404 3800 KV ×6, Nazgul T4030, 4S LiPo**
- [x] Video system chosen — **HDZero Whoop V2 + Nano V3**
- [x] Printed parts done — TPU mounts, **XT60/capacitor/ELRS-antenna holder**, **landing gear**
- [x] Assembled
- [x] ELRS bound (`dwdrones`) — RP3 fitted
- [x] **VTX power solved** — Matek Micro BEC bought (6–60 V → 5/9/12 V, OCP + thermal shutdown, 2 g)
- [ ] ⛔ **Replacement Whoop V2 VTX fitted, powered from the Matek BEC** (due 2026-09-02)
- [ ] ⚠ **BEC left at 5 V default, or jumpered to 9 V — never 12 V** (12 V is only 0.6 V under the
      VTX's ceiling)
- [ ] Capacitor fitted at the VTX supply (HDZero recommends one even at 3S)
- [ ] Betaflight mixer confirmed — **ships defaulted to Y6**; still verify motor order and direction
- [ ] First hover; **budget tuning time for the "bobbles"**
- [ ] **Check motor temps by hand after the first pack** (3800 KV on 4" at 4S)
- [ ] Measured AUW on a scale
- [ ] Decide whether a GPS goes on (would take the last of 3 UARTs)

## Build log

- **2026-09-01** — **VTX power solved: a Matek Micro BEC** (6–60 V in → 5 V/9 V/12 V out, 2.6–2.8 A
  at 4S input, **OCP with hiccup + thermal shutdown**, 18×15×4.5 mm, 2 g). This is better than either
  option previously recorded — it takes the VTX off the Specter's pack pad entirely instead of
  depending on an onboard 5 V rail whose current HGLRC never published, and it adds overcurrent and
  thermal protection the pad didn't have.
  ⚠ **One way to get it wrong, recorded prominently: the BEC selects 9 V or 12 V by soldering a
  jumper, and 12 V must not be chosen.** 12 V is inside the Whoop V2's 3–12.6 V range by only 0.6 V —
  it would rebuild the CL35's no-margin situation on the aircraft that just lost a VTX, for no gain.
  **5 V is the factory default and needs no action** (HDZero's ≥1.5 A requirement is met at 2.8 A);
  **9 V is the best choice** if soldering anyway, sitting mid-window with margin both ways.
- **2026-09-01** — **Built.** Six **iFlight XING 1404 3800 KV** on **Nazgul T4030** props, the
  **HGLRC Specter 6-in-1**, an **RP3**, a **Cherry** antenna, **HDZero Whoop V2 + Nano V3** for
  video, running **4S** — which closes the sub-250 g question by abandoning it. Printed and fitted a
  custom **XT60 / capacitor / ELRS-antenna holder** and **landing gear**.
  **The VTX was destroyed**: the Specter's digital-video pad is labelled **`7.4–26.4 V`** in its
  manual (raw pack voltage) and the Whoop V2's range is **3–12.6 V**, so 4S handed it 16.8 V.
  The prior reasoning — that the MicoAir 743's regulated 12 V on the CL35 made pack voltage a
  non-issue — was half right: the two boards do differ, but **12 V was 0.6 V under the ceiling, not
  comfortable margin**. Recorded the generalisable rule that an AIO's "digital VTX" pad is not a
  standard rail and must be read per board. Replacement due 2026-09-02; it must not go back on the
  same pad.
  Also pulled the **official manual** (v1.0) and corrected the spec table from it — **13.2 g**, not
  the listing's 14 g; 8.4–**26.1** V — and found a genuinely useful detail: the board **ships
  defaulted to the Y6 mixer** (options are Y6 and HEX X only). Noted that the **XING 1404 3800 KV is
  a 2–4S motor at 11.8 A max continuous**, so this build runs it at its rated voltage ceiling on the
  aggressive end of iFlight's own prop pairing — worth a hand temp-check after the first pack, with
  six-motor load-sharing as the mitigating factor.
- **2026-08-17** — **Frame ordered**: Reliant V2 (F121) from cncdrones.com, $29, cut to order,
  bought in the same order as the [Carnage 4.5](../carnage-45/README.md). Trigger was finding the
  **HGLRC Specter 6-in-1 AIO** ($99.99) — a 6-output AIO, which a Y6 requires and which is rare in
  this class. Source design details recovered: it's **eyefly's open-source "Reliant" V2** (CC BY-NC),
  designed as a **long-range** Y6 around **1404 motors, 4" props and 3S Li-Ion** for 16–20 min — not
  as a sub-250 g airframe, so the 250 g goal is an added constraint needing its own budget. Recorded
  the designer's hardware list, TPU print settings, and the reviewer warning that it takes tuning to
  settle down.

## Links

- **Vendor (frame, cut to order)** — Reliant V2, cncdrones.com F121: <https://cncdrones.com/reliant--long-range-y6.html>
- **Source design + 3D print files (TPU mounts)** — Thingiverse, eyefly: <https://www.thingiverse.com/thing:4845387>
- **FC** — HGLRC Specter 6-in-1 AIO F722 + 40A ESC, getfpv: <https://www.getfpv.com/hglrc-specter-6-in-1-aio-f722-fc-40a-esc.html>
  - **Manual v1.0** (in-repo): [`docs/manuals/HGLRC Specter F722 40A 6-in-1 AIO Manual v1.0.pdf`](../docs/manuals/HGLRC%20Specter%20F722%2040A%206-in-1%20AIO%20Manual%20v1.0.pdf)
    — first half Chinese, second half English. Source of the `7.4–26.4 V` pad label, the 13.2 g
    weight and the Y6-default mixer note.
  - Vendor page: <https://www.hglrc.com/products/hglrc-specter-f722-40a-6-in-1-high-performance-aio>
- **VTX** — HDZero Whoop V2, official spec (**3–12.6 V**): <https://docs.hd-zero.com/whoop-v2>
- **Camera** — HDZero Nano V3: <https://docs.hd-zero.com/camera-nano-v3>
- **Motors** — iFlight XING 1404 3800 KV: <https://www.getfpv.com/iflight-xing-1404-3800kv-4600kv-7000kv-unibell-toothpick-motor-blue-camo-1pc.html>
- **Props** — iFlight Nazgul T4030: <https://www.getfpv.com/iflight-nazgul-t4030-2-blade-propeller-set-of-4.html>
- Spacer bolts (designer's link): <https://www.aliexpress.com/item/32831145268.html>

### Designer

- Design walkthrough video: <https://youtu.be/a4PtNFgEqVc>
- Build and maiden: <https://youtu.be/cPlAa_vi6e8>
- Build-support Discord: <https://discord.gg/488xg7tMD5>
- More designs: <https://www.thingiverse.com/eyefly/designs> · <https://www.youtube.com/c/eyeflytinkerings>
