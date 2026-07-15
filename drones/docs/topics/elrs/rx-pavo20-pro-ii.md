# ELRS Receiver Setup — Pavo20 Pro II

Receiver: onboard Serial ELRS 2.4 G on the BETAFPV F4 2-3S 20A AIO FC V1 (UART/CRSF, enameled wire
antenna). Firmware at time of setup: **ELRS 3.5** (shipped). No reflash required — TX was 3.3, and
ELRS only requires matching *major* versions (3.x ↔ 3.x).

Related: [ELRS index](README.md) · [Radio setup](radio-tx16s.md) · [Pavo pairing + tests](pairing-pavo20-pro-ii.md)

## Procedure (WebUI method)

1. Power the FC via USB. **Radio off** — the RX must fail to find a TX.
2. Wait ~60 seconds. The RX gives up and enters WiFi mode (LED flashing rapidly).
3. Join WiFi network `ExpressLRS RX`, password `expresslrs`.
   - AP signal is very weak — device within ~1 ft of the quad.
   - **Use a laptop.** Phones fight captive-portal-less APs (drop to cellular, serve cached pages).
     If a phone must be used: airplane mode + WiFi only + private/incognito tab.
4. Browse to `http://10.0.0.1`.
5. Set the **binding phrase** `dwdrones` (case-sensitive). Save.
6. Power cycle. Done — RX now auto-binds to any TX carrying the same phrase.

## Gotchas learned the hard way

- **Setting a bind phrase hides the WebUI bind button** and effectively supersedes manual binding —
  the phrase *is* the binding. Don't go looking for a bind mode afterward.
- **Do not touch the Home WiFi fields** in the WebUI. Known ELRS bug: saving WiFi credential changes
  can wipe the stored bind phrase (ExpressLRS/ExpressLRS#2864).
- The 3× power-cycle bind method needs each ON period under ~2 s. Through a PC USB port (enumeration
  delays) it's unreliable — use a USB power brick if ever needed. With a phrase set, it's moot.
- RX entering WiFi mode during normal use just means the radio wasn't on within 60 s of power-up.
  Power cycle with the radio already on.

## Verified end state

- ELRS 3.5, bind phrase set via WebUI.
- Solid RX LED within ~5 s of power-up with radio on.
- Firmware update path if ever needed: WebUI upload, or Betaflight passthrough in ExpressLRS
  Configurator, target `BETAFPV 2.4GHz AIO RX`.
