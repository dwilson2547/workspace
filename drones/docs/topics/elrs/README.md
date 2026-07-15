# ELRS radio link

The ExpressLRS 2.4 GHz control link shared across all my craft. One handset (RadioMaster TX16S)
flies every drone; each drone's receiver is bound with the same phrase, so there is no per-quad
bind ritual.

## Doc set

| Doc | Scope |
|-----|-------|
| [radio-tx16s.md](radio-tx16s.md) | **Radio config** (TX16S internal ELRS) — once per radio + once per model |
| [rx-pavo20-pro-ii.md](rx-pavo20-pro-ii.md) | Pavo20 Pro II **receiver** setup |
| [pairing-pavo20-pro-ii.md](pairing-pavo20-pro-ii.md) | Pavo20 Pro II **pairing procedure followed + tests completed** |
| [rx-x500-rp3.md](rx-x500-rp3.md) | X500 (RadioMaster RP3) **receiver** setup — _pending build_ |
| [pairing-x500.md](pairing-x500.md) | X500 **pairing + tests** — _pending build_ |

## Binding phrase

**`dwdrones`** — shared across all receivers. Committed to the repo intentionally: it is not a
password reused anywhere else, and hijack risk is limited to RF range of a hobby drone. Treat it as
config, not a secret. (Set via WebUI on each RX, and on the TX — no flashing needed since ELRS 3.0.)

## Version rule

TX and RX must share a **major** version (3.x ↔ 3.x); a minor mismatch is fine. Verified working:
**TX16S 3.3 ↔ Pavo20 RX 3.5**. If any RX is on 2.x, update it to 3.x before it can bind. If a future
RX is 4.x, the TX16S internal module must be moved to 4.x too.

## Adding a new quad — checklist

1. Check RX firmware version (WebUI info tab, or Lua when bound). If 2.x → update to 3.x first
   (WebUI upload or Betaflight passthrough).
2. Set bind phrase `dwdrones` via the RX WebUI (see that quad's `rx-*.md` doc).
3. Create an EdgeTX model (or clone an existing one) — internal RF = CRSF.
4. Run the test ladder below and record results in that quad's `pairing-*.md` doc.

## Test ladder

Run in order; each step gates the next.

### 1. Link test
- Radio on, correct model selected → power the quad (USB fine).
- **Pass:** RX LED solid within ~5 s; ELRS Lua shows `C` top-right with link-quality stats.
- **Fail:** LED still blinking → phrases don't match (case-sensitive) or major-version mismatch. LED
  fast-flash after 60 s = RX gave up and is in WiFi mode; power cycle with radio on.

### 2. Channel test (Betaflight Receiver tab, USB)
- Sticks: verify AETR mapping — each stick moves the right bar, full range, centered at 1500
  (throttle low ≈ 1000).
- Switches: flip each one, note which AUX bar moves. **This is the source of truth for the switch
  map** — update the radio doc if reality disagrees.

### 3. Modes test (Betaflight Modes tab)
- Flip arm switch: marker enters the ARM range; tile shows **ARM (DISABLED)** in red — correct over
  USB (MSP arming block). `status` in CLI lists the active arming-disable flags.
- Verify angle / turtle ranges the same way.

### 4. Bench motor test — **PROPS OFF**
- USB disconnected, battery in, radio on. Arm → motors spin gently. Disarm → stop.

### 5. Failsafe test — **PROPS OFF**
- Armed, motors spinning → turn the radio off.
- **Pass:** motors stop within ~1 s. Radio back on, disarm.
- Non-negotiable before first flight on any new quad or after RX firmware changes.

### 6. Range sanity (optional, before flying far)
- Quad powered at the far end of the yard, watch LQ/RSSI in Lua or OSD. 250 Hz 2.4 GHz ELRS at
  whoop power vastly exceeds LOS distances; anything under ~95 LQ close-in means an antenna problem.

## Standing rules

- Radio on **first**, battery in last. Reverse order to shut down.
- Never arm within arm's reach of anyone's head. Disarm is the answer to every "it's touching
  something it shouldn't" situation — including ceilings (ceiling suction + I-term windup = max
  throttle grind).
- Never grab an armed quad.
- After any config change: capture `diff all` from the Betaflight CLI into the repo (per-quad
  factory-restore point).
