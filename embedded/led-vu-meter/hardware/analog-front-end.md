# Analog front-end — PC headphone → SAMD51 ADC

Passive network: sums stereo L+R to mono, blocks DC, biases the signal to mid-rail
(1.65 V) so the AC audio sits centered in the 0–3.3 V ADC window. **No op-amp** — a PC
headphone output (~1 V RMS max, low source impedance) is already a comfortable level,
and software auto-gain in firmware covers quiet playback. The network only needs to
center the signal and give a little clipping headroom.

## Schematic

```
                 +3.3V
                   │
                  [R1 10k]
                   │
   VREF_MID ◄──────┼────────────────┐  1.65 V "stiff" reference
   (1.65 V)        │                │
                  [R2 10k]         [Cb 10µF]  ── to GND
                   │                │
                  GND              GND


   L tip ──||────[ R_L 4.7k ]──┐
          CinL 2.2µF            │
                                │   node N        Rs 1k
   R tip ──||────[ R_R 4.7k ]──┼─────────────────[====]──●── A1 (ADC in)
          CinR 2.2µF            │                         │
                                │                       [Cadc 4.7nF]
   VREF_MID ──[ Rb 4.7k ]───────┘                         │
                                                          GND
   jack sleeve / GND ──────────────────────────────── board GND
```

- **R1 / R2 (10k each) + Cb (10µF)** make a stiff 1.65 V reference (`VREF_MID`). Cb turns
  it into an AC ground so the bias point doesn't wobble with the signal. (Divider corner
  ≈ 3 Hz — well below audio.) Do **not** put a big cap on node N itself, or it shorts the
  audio.
- **CinL / CinR (2.2µF) + R_L / R_R (4.7k)** AC-couple each channel (blocks the PC's DC)
  and sum L+R into node **N**. High-pass corner ≈ 1/(2π·4.7k·2.2µF) ≈ **15 Hz** — passes
  bass, kills subsonic/DC.
- **Rb (4.7k)** ties node N to `VREF_MID`, setting its DC level to 1.65 V.
- **Rs (1k) + Cadc (4.7nF)** at the ADC pin: gives the SAR sample-and-hold a charge
  reservoir *and* forms a gentle ~10 kHz low-pass (light anti-aliasing).

Cap polarity: node side of Cin sits at ~1.65 V DC, the jack side at ~0 V. Use **film or
bipolar** caps; if you only have polarized electrolytics, put **+ toward node N**.

## BOM

| Ref | Value | Notes |
|-----|-------|-------|
| R1, R2 | 10 kΩ ×2 | bias divider |
| R_L, R_R | 4.7 kΩ ×2 | channel summing |
| Rb | 4.7 kΩ | node bias tie |
| Rs | 1 kΩ | ADC series / S&H |
| CinL, CinR | 2.2 µF ×2 | input coupling (film/bipolar pref.) |
| Cb | 10 µF | VREF bypass |
| Cadc | 4.7 nF | ADC reservoir / anti-alias |
| — | 3.5 mm stereo jack | breakout to L / R / GND |

All common values you likely already have. Nothing is critical to ±5%.

## Level budget

Per channel, node N attenuation ≈ (R_other ‖ Rb) / (R_chan + (R_other ‖ Rb))
= 2.35k / 7.05k ≈ **0.33 (−9.5 dB)**.

- Worst case (mono/correlated content, both channels in phase, full volume ~1 V RMS each):
  node ≈ 0.67 × 1 V RMS ≈ 1.9 V p-p → swings **0.71 V … 2.59 V** around the 1.65 V bias.
  Inside 0–3.3 V with margin → **no clipping** even at max volume.
- Normal listening level (−15 to −30 dB) → much smaller swing → **software auto-gain**
  (track running peak, scale the display) keeps the meter lively. This is the deliberate
  trade for skipping an AGC mic-amp.

Node impedance (~2.35 k) is low enough for the ADC, but still set a generous ADC sample
time in firmware (SAMD51 `SAMPCTRL`) — the Rs+Cadc reservoir helps.

## Bring-up checks (before any firmware)

1. **Power off / no signal:** with the network on the 3.3 V rail, DMM from node N to GND
   should read **≈ 1.65 V**. If not, check R1/R2 and Rb solder joints.
2. **VREF_MID** should also read ≈ 1.65 V and be stable.
3. **With audio playing**, AC-couple a scope (or cheap USB scope) at node N: you should see
   the waveform centered on 1.65 V, staying between ~0.7 V and ~2.6 V at high volume. If it
   pins near 0 or 3.3 V, lower volume or drop R_L/R_R relative to Rb to attenuate more.
4. Only then wire node N's `Rs` output to **A1**. Don't feed the ADC anything outside
   0–3.3 V — the SAMD51 has clamp diodes but they're a last resort, not a design feature.

## Build notes / lessons (perfboard rev)

- **`Cadc` value matters a lot.** The corner is `1/(2π·R·C)` with `R` ≈ `Rs` + node-N Thévenin
  (≈ 2.2 k total), **not** just `Rs`. So the design `4.7nF` (marked `472`) → ~15 kHz (good).
  The first perfboard accidentally used a **`474` (0.47µF)** → corner ≈ **150 Hz**, which killed
  everything above the bass (had to crank gain to see mids/highs). One-digit marking trap:
  `472`=4.7nF, `473`=47nF, `474`=0.47µF — an order of magnitude apart each. Want **`472`**.
- **No µF-range cap works here** — even `104` (0.1µF) lands the corner at ~720 Hz. The anti-alias
  cap must be in the **nF** range; through-hole 4.7nF/47nF ceramics are common and cheap (no SMD
  needed). Order a strip of `472` with the PCB.
- **Running with `Cadc` removed is a valid stopgap** (current perfboard state): full audio
  bandwidth, only cosmetic aliasing above the ~6.5 kHz Nyquist (swept tones >15 kHz fold back as
  phantom "resonances"). `SAMPLEN=16` in firmware already covers the S&H without the reservoir cap.

## PCB (KiCad) roadmap

Planned: turn this passive front-end into a small custom PCB — the project's first KiCad board and
a deliberate warm-up for the more complex race-logger boards.

- **Scope:** just this stage — the BOM above plus a 3.5 mm stereo input jack and a short
  pigtail/header to the Matrix Portal's **A1 / 3.3 V / GND**. Keep `Cadc` as a populated `472`
  footprint (0805 or through-hole) so anti-aliasing is back on the real board.
- **Learn the full flow:** schematic → assign symbols → footprints → layout → DRC → Gerber/fab
  export → order samples (JLCPCB/OSHPark/etc.). Low pin count, no SI concerns — ideal first pass.
- **Footprint choice:** through-hole keeps hand-assembly trivial; a mixed 0805-SMD-passives +
  TH-jack board is a gentle intro to SMD if wanted. Either is fine at this complexity.
- **Open items before ordering:** finalize connector to the Matrix Portal (header vs. JST vs.
  flying leads), board outline / mounting, and whether to add silk test points at node N and
  `VREF_MID` for the bring-up checks above.

KiCad project will live under `hardware/pcb/` when started.

## If you change your mind later

This whole stage is replaceable without touching firmware structure: a **PCM1808** I2S
ADC or a **MAX9814** mic-amp would swap in here. We chose the passive route because the
source level is friendly and it removes I2S-vs-Protomatter integration risk. See
`docs/decisions/0002-analog-front-end-builtin-adc.md`.
