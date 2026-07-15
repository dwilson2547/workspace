---
tier: reference
domain: drones
---

# BetaFPV Pavo20 Pro II

2.2" ducted FPV cinewhoop, sub-250 g, built around the DJI O4 digital FPV system. This is the
"Pavo20 Pro 2." Intended for smooth cinematic FPV — the opposite end of the spectrum from the X500.

## Spec

As configured (BNF).

| Item | Part | Notes |
|------|------|-------|
| Frame | Pavo20 Pro II, 93.9 mm wheelbase | PA12 thickened whoop ducts; 4-screw embedded-nut build |
| Flight controller | BETAFPVF405 — F4 2–3S 20 A AIO (~5.92 g) | 9V 2A for O4, 5V 3A for peripherals; Betaflight 4.5.3 |
| Motors | LAVA 1104 7200 KV (×4) | Plug-in (no solder) |
| Props | Gemfan 2218 3-blade (2.2") | |
| Video / FPV | **DJI O4 Air Unit** (standard, 4K 60fps) + DJI Goggles N3 | not the O4 Pro |
| RC link | **ELRS 2.4 GHz**, built-in AIO RX (v3.5) | bind phrase `dwdrones` — [rx setup](../docs/topics/elrs/rx-pavo20-pro-ii.md) · [pairing + tests](../docs/topics/elrs/pairing-pavo20-pro-ii.md) |
| Battery | BetaFPV LAVA II 3S 680mAh 95C LiHV (XT30) ×2 | |
| AUW | < 150 g (with battery) | Sub-250 g class |

- **Betaflight setup notes:** [`betaflight.md`](betaflight.md) (changes made, throttle feel, outstanding items)
- **Betaflight config dump:** [`betaflight_config.cfg`](betaflight_config.cfg) (BETAFPVF405, BF 4.5.3, dumped 2026-07-15)
- **Parts on hand & spares:** [`inventory.md`](inventory.md)

## Status

- [x] Bound to radio (ELRS, phrase `dwdrones`)
- [x] Goggles / O4 video linked
- [ ] Betaflight config reviewed (rates, filters)
- [x] First flight

## Build & flight log

- **2026-07-15** — First flying session. Configured ELRS: Pavo RX on **3.5**, TX16S Mark II
  internal ELRS on **3.3** — both 3.x, bound & flew with no compatibility issues. Binding phrase
  `dwdrones`. Dumped the Betaflight config → [`betaflight_config.cfg`](betaflight_config.cfg).

## Links

- Product: <https://betafpv.com/products/pavo20-pro-ii-brushless-whoop-quadcopter>
- Frame only: <https://betafpv.com/products/pavo20-pro-ii-brushless-whoop-frame>
- Review (Oscar Liang): <https://oscarliang.com/betafpv-pavo20-pro-v2/>
