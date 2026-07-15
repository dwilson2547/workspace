# ELRS Pairing — Pavo20 Pro II

Record of the pairing actually performed on the Pavo20 Pro II and the tests completed. Generic
procedure and full test ladder: [ELRS index](README.md). Receiver details:
[rx-pavo20-pro-ii.md](rx-pavo20-pro-ii.md).

- **Date paired:** 2026-07-15
- **TX:** RadioMaster TX16S Mark II, internal ELRS 3.3, model `Pavo20`, CRSF, 250 Hz
- **RX:** BETAFPV F4 2-3S 20A AIO onboard ELRS 3.5
- **Bind method:** shared phrase `dwdrones` set via RX WebUI (no bind button)
- **Result:** bound on power-up, solid RX LED within ~5 s, flew the same day

## Tests completed

| # | Test (ladder step) | Result | Notes |
|---|--------------------|--------|-------|
| 1 | Link test (LED solid / `C` on Lua) | ✅ Pass (2026-07-15) | solid within ~5 s |
| 2 | Channel test — AETR + switches (BF Receiver tab) | ✅ Pass | switch/mode map logged in [betaflight.md](../../../pavo20-pro-2/betaflight.md) (AUX1 arm, AUX2 angle/horizon) |
| 3 | Modes test (BF Modes tab) | ✅ Pass | ranges configured — see [betaflight.md](../../../pavo20-pro-2/betaflight.md) |
| 4 | Bench motor test — **props off** | ⬜ confirm | not recorded |
| 5 | Failsafe test — **props off** | ✅ Pass | radio-off drop verified (per [betaflight.md](../../../pavo20-pro-2/betaflight.md)) |
| 6 | Range sanity | ⬜ optional | |
| — | **First flight** | ✅ Pass (2026-07-15) | maiden session |

> Only the props-off **bench motor test** is left unrecorded — check it if you did it, or run it
> before the next new build. Channel/mode map and the radio-off failsafe are documented in
> [betaflight.md](../../../pavo20-pro-2/betaflight.md); the switch-source placeholders in
> [radio-tx16s.md](radio-tx16s.md) can be filled from that map.

## Config snapshot

- Betaflight `diff all`: [`../../../pavo20-pro-2/betaflight_config.cfg`](../../../pavo20-pro-2/betaflight_config.cfg)
  (BETAFPVF405, BF 4.5.3, dumped 2026-07-15)
