# Agent-invented hardware specs in build docs get configured against as fact

**Date:** 2026-09-17  
**Component:** `drones/<craft>/README.md` build/config docs — fleet-wide pattern; the DH600 incident forced the fix  
**Severity:** High — wrong values in build docs are acted on physically: miswired ports, failed
arming checks, and tuning sessions spent fighting conflicts that never existed

---

## Observed symptom

During DH600 tuning (2026-09-17), the agent consulted mid-build kept raising nonsensical
conflicts — e.g. "you can't use channel 5 for flight modes, that's pegged for the video system" —
for a video system that was not yet online, or even finally wired. Tracing it back: earlier doc
edits by an agent had assigned RC channels and serial ports to accessories (video system,
gimbal functions) that were never wired. The docs asserted these assignments with the same
confidence as the verified rows, so every later session — human or agent — treated them as
constraints. Not the first time agents have invented specs to fill out a
form; the DH600 cleanup (`f78e308`…`3258646`) is just the most expensive instance.

---

## Root cause

### A plan written in the present tense outlived the plan

`git log -S GPS2` shows the receiver-on-GPS2 claim was not a random guess. It entered on
2026-07-26 (`b049983`, `bd5ef70`) as a reasoned design decision: at that point the HM30's S.Bus was
going to occupy RC IN, so ELRS went to GPS2 as CRSF. The HM30-carries-RC plan was dropped the same
day; the GPS2 assignment stayed, written as "ELRS on GPS2" rather than "plan: ELRS → GPS2". Seven
weeks later the receiver was wired to TELEM1 and the doc was never reconciled. Any agent reading
the head of the README in September saw a present-tense fact and re-asserted it (`4274d47`).

### The design doc was drafted from the ArduPilot wiki, not from the fleet's param file

The July doc reserved RC6/RC7 for gimbal pitch/yaw, following the ArduPilot mount examples. The
X500's param dump already had `FLTMODE_CH=6` — flight modes on RC6 — and the DH600 was going to
copy the X500's radio model. The gimbal assignment conflicted with the fleet standard on the day
it was written; nobody diffed the plan against an existing craft's params.

### Docs had no "unknown" or "planned" state

Nothing in the doc distinguished "measured on the bench" from "decided on paper" from "sounds
right". Once written, all three read the same, so the only way to tell them apart was git history
— which mid-build sessions do not read.

### Standards governed placement, not provenance

`CLAUDE.md`, `CONVENTIONS.md`, and the workspace-conventions skill specified *where* files go and
*how* notes are captured, but said nothing about the factual provenance of content. Corrections
lived in per-tool memories, which do not travel to other agents — repo-local standards do.

### Hallucinated claims propagate forward

Once written, an invented assignment is load-bearing: later sessions plan around it, flag
"conflicts" against it, and resist the real setup because it contradicts the doc. The cost lands
on future sessions, not the one that invented the value.

---

## Troubleshooting steps taken

1. **Compared doc claims against the as-built aircraft** — the docs claimed ELRS on GPS2 in
   several places; the receiver had actually been wired to **TELEM1** since electrical bring-up.
2. **Compared against the `dh600.param` dump** — confirmed the real channel map
   (`FLTMODE_CH=6`, `RC5_OPTION=153`, `RC2_REVERSED=1`) and used it as ground truth.
3. **Committed corrections with explicit messages** ("kill the last three ELRS-on-GPS2 claims",
   "HM30 goes on TELEM3, not GPS2") so history records that the surviving text was fought for,
   not drafted.
4. **Deleted the unverifiable sections** (HM30 / gimbal configuration) rather than "fixing" them
   — content that can't be checked against hardware gets removed, not re-guessed.

---

## Fix

### `drones/dh600/README.md` — status markers in place

The serial/wiring table gained a `✅ verified / ⬜ planned` status column with the legend *"Do not
configure against a ⬜ row without eyes on the board first."* Unverifiable configuration prose was
deleted outright.

### Workspace standards — provenance codified (2026-09-17)

- `CONVENTIONS.md` §10 — workspace-wide factual-provenance rule: every specific claim is
  verified, planned, or `⚠ unverified`; agents never fill gaps from "typical" setups and never
  upgrade a claim's status without measurement, a dump, or the user's word.
- `CLAUDE.md` + `meta/SKILLS/workspace-conventions/SKILL.md` — the behavioral summary every agent
  on any clone inherits.
- `drones/docs/topics/hardware-docs.md` — the `✅/⬜` status-column convention as the domain
  standard for any table an agent might configure from.
- `drones/docs/topics/ardupilot-build-standard.md` — the fleet's shared radio/channel map written
  down once, so copied profiles are checked against a table instead of re-derived (or invented).

---

## Files changed

- `drones/dh600/README.md` — status column, as-built serial corrections (commits `f78e308`,
  `4274d47`, `7319f62`, `d01a433`, `3258646`)
- `CONVENTIONS.md` — §10 appended
- `CLAUDE.md` — provenance bullet
- `meta/SKILLS/workspace-conventions/SKILL.md` — provenance section
- `drones/docs/topics/hardware-docs.md` — created
- `drones/docs/topics/ardupilot-build-standard.md` — created
