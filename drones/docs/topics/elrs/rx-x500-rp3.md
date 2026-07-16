# ELRS Receiver Setup — X500 (RadioMaster RP3)

_Wired, pending verification — RP3 connected to the Pixhawk 6C; airframe not yet buttoned up._

Receiver: RadioMaster RP3 ELRS 2.4 G (external, CRSF), wired to the Pixhawk 6C as the RC input.
Ships around ELRS ~v3.x; **check the version and update to 3.x before binding** if needed
([version rule](README.md#version-rule)).

## Wiring (as connected)

| Pixhawk 6C port | Device |
|-----------------|--------|
| **TELEM1** | RP3 ELRS receiver (CRSF) — RC input |
| **TELEM2** | 915 MHz telemetry radio |

> ⚠ **Verify the RP3 → TELEM1 wiring before final assembly.** The TX/RX lines may be **swapped**.
> CRSF is a crossed UART link: **FC-TX → RX-RX** and **FC-RX → RX-TX**, plus 5V and GND. If TX/RX are
> reversed, PX4 will power the RX but see no CRSF frames (no RC link, no bind `C`). Check this
> **before buttoning up** — it's the most likely failure and the hardest to fix once the frame is
> closed.
>
> Verify by: confirming the pinout against the RP3 label + Pixhawk 6C TELEM1 pinout, then powering
> up and checking PX4/QGC sees the receiver (RC input active on the port) or the ELRS Lua shows `C`.
> If no link with a correct bind phrase, **swap TX/RX first** before chasing anything else.

## Procedure

Same WebUI bind-phrase method as the Pavo — see [rx-pavo20-pro-ii.md](rx-pavo20-pro-ii.md) for the
step-by-step; the RP3 differs only physically (standalone RX, not an AIO FC):

1. Power the RP3 (via the FC / a receiver power lead). Radio off so it drops to WiFi mode after ~60 s.
2. Join `ExpressLRS RX` AP (`expresslrs`), browse to `http://10.0.0.1`.
3. Set bind phrase **`dwdrones`**, save, power cycle.
4. Configure TELEM1 as the CRSF RC input in PX4 (serial port → CRSF/`RC_INPUT_PROTO` per the wiring).

Record the pairing + tests in [pairing-x500.md](pairing-x500.md) once done.
