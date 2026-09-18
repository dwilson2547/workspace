---
name: drones
description: Interactive session for work under drones/ — builds, tuning, wiring, ArduPilot/Betaflight config, and the craft docs. Start with `claude --agent drones`.
---

You are working in the `drones/` domain of Daniel's workspace. Everything in CLAUDE.md and
CONVENTIONS.md still applies. These are the domain invariants on top of it.

## Source of truth

- **The craft's `.param` file is the board.** `drones/<craft>/<craft>.param` is the only as-built
  record of configuration. The README is a plan wherever the two disagree.
- **Before writing any port, channel, protocol, or parameter value, grep the param file.** If the
  value is not there and not visible on the hardware, the cell gets `⬜ planned` or `⚠ unverified`.
  Never fill it from the ArduPilot default, the wiki, or another "typical" setup.
- **Only a measurement, a param dump, or Daniel moves a claim to ✅.** Rewriting the prose around
  a value is not evidence.

## Fleet standard

One TX16S model across every ArduPilot craft. Copy this; never re-derive it.
Full table and open exceptions: `drones/docs/topics/ardupilot-build-standard.md`.

| Param | Value |
|---|---|
| `FLTMODE_CH` | 6 (modes on RC6, not the ArduPilot default of 5) |
| `RC5_OPTION` | 153 (arm/disarm on RC5) |
| `RC2_REVERSED` | 1 (pitch inverted) |
| ELRS bind phrase | `dwdrones` |

## Docs

- Wiring, port, and channel tables carry a `✅ verified / ⬜ planned` status column with the legend
  under the table. Convention: `drones/docs/topics/hardware-docs.md`.
- **Plans are dated and future-tense.** Write `plan (2026-09-17): HM30 → TELEM3`, never
  `HM30 on TELEM3`. A present-tense plan becomes a false fact the day the build diverges.
- Conclusions Daniel brings back from a web discussion are recorded as a dated plan entry, not
  as as-built.
- Build-log entries are history: annotate them as superseded, never rewrite them.
- A choice between options is a `docs/decisions/NNNN-<slug>.md` entry in the craft's folder, with
  a `**Status:**` header. A changed plan is a new entry marked `superseded by`; never edit the old
  one. The README cites the entry number where it states the outcome.
- When you correct an invented or stale value, say so in the commit message.

## On live hardware

- One action per reply. Daniel is at the bench; his observations are measurements, not theories
  to argue with.
- Do not configure against a `⬜` row without eyes on the board first.

## Procedures already written — read, do not re-derive

- Param dump workflow and GCS-vs-board disagreement: `drones/docs/topics/param-files.md`
- Mission Planner on Linux: `drones/docs/topics/mission-planner-linux.md`
- ELRS binding, receivers, TX16S: `drones/docs/topics/elrs/`
- Blackbox analysis: `drones/docs/topics/blackbox-analysis.md`
