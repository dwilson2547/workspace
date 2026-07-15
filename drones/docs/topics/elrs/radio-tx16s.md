# ELRS Transmitter Setup — RadioMaster TX16S (internal ELRS)

Firmware at time of setup: **ELRS 3.3** on the internal 2.4 GHz module. Compatible with any 3.x
receiver — no flashing was required to set the bind phrase (WebUI supports runtime phrase changes
since ELRS 3.0).

Related: [ELRS index & test ladder](README.md) · [Pavo20 receiver](rx-pavo20-pro-ii.md)

## Model setup (EdgeTX) — once per aircraft

1. **MDL** button → Model Select → long-press ENT on an empty slot → **New model**.
2. Name it (e.g. `Pavo20`).
3. Model Setup → **Internal RF → Mode: CRSF**. External RF off.
4. **Mixes** page: CH1–CH4 = AETR (sticks). Switch channels:
   - CH5 → AUX1 = **arm switch** (source: _____ )
   - CH6 → AUX2 = **angle mode** (source: SD)
   - CH7 → AUX3 = **turtle mode** (source: _____ )
   - Fill in / correct sources above — AUX numbering is positional (CH5=AUX1 etc.); the physical
     switch is whatever the mix says. **Always verify with the Betaflight Receiver-tab wiggle test;
     never trust memory.**
5. To invert a switch's direction, edit the mix Weight from `100` to `-100` (keeps convention:
   arm = channel high ≈ 2000).

## ELRS module config — once per radio

1. **SYS → Tools → ExpressLRS** (Lua script). Confirms the internal module is alive.
2. Set **Packet Rate: 250 Hz**.
3. Top-right of the Lua screen shows `C` when connected to a bound RX.

## Bind phrase — once per radio, no flashing

Phrase: **`dwdrones`** (shared across all craft — see the [index](README.md#binding-phrase) for the
commit-intentionally rationale).

1. Lua script → **WiFi Connectivity → Enable WiFi**. Radio spins up an `ExpressLRS TX` AP
   (password `expresslrs`).
2. From a laptop, join it and browse to `http://10.0.0.1`.
3. Binding tab → enter the phrase. Save.
4. Disable WiFi / reboot. Every RX flashed or WebUI-configured with the same phrase now binds
   automatically on power-up.

## Gotchas

- **Do not modify Home WiFi fields** in the TX WebUI — same phrase-wipe bug as the RX side
  (ExpressLRS/ExpressLRS#2864).
- Model files back up as YAML on the radio's SD card under `/MODELS/` — copy into the repo rather
  than transcribing settings.
- Stick calibration lives at SYS → Hardware → Calibration (done at first boot; only redo if
  sim/Receiver tab shows range problems).
- Future TX firmware updates: ExpressLRS Configurator, target RadioMaster TX16S internal 2.4 GHz,
  re-enter the bind phrase at build time or re-set it via WebUI after.
- Manual: [`../../manuals/TX16S Mk 2 Manual.pdf`](../../manuals/TX16S%20Mk%202%20Manual.pdf)
