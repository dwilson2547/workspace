# ELRS Receiver Setup — X500 (RadioMaster RP3)

_Pending — the RP3 is on hand but not yet installed on the X500 (airframe not built)._

Receiver: RadioMaster RP3 ELRS 2.4 G (external, wired to the Pixhawk 6C as the RC input, CRSF).
Ships around ELRS ~v3.x; **check the version and update to 3.x before binding** if needed
([version rule](README.md#version-rule)).

## Procedure (to follow when installed)

Same WebUI bind-phrase method as the Pavo — see [rx-pavo20-pro-ii.md](rx-pavo20-pro-ii.md) for the
step-by-step; the RP3 differs only physically (standalone RX, not an AIO FC):

1. Power the RP3 (via the FC / a receiver power lead). Radio off so it drops to WiFi mode after ~60 s.
2. Join `ExpressLRS RX` AP (`expresslrs`), browse to `http://10.0.0.1`.
3. Set bind phrase **`dwdrones`**, save, power cycle.
4. Wire CRSF TX/RX to a Pixhawk 6C UART; configure that UART as the RC input in PX4
   (`RC_INPUT_PROTO` / TELEM/RC port per the wiring).

Record the pairing + tests in [pairing-x500.md](pairing-x500.md) once done.
