---
title: Hardware wiring & config docs — the verified/planned status convention
date: 2026-09-17
tags: hardware,wiring,documentation,convention,provenance
---

# Hardware docs: verified vs planned

Standard for any doc in this domain that records wiring, port maps, channel assignments, or
on-aircraft configuration. Written after the 2026-09-17 incident in which an agent invented
accessory channel assignments in the DH600 docs and a later build session configured against them
([issue](../issues/2026_09_17_agent_invented_hardware_specs.md)).

## The rule

Any table that an agent or a future build session might *configure from* carries a status column:

- **✅ verified** — physically wired and confirmed on the aircraft, or read from a param dump /
  the GCS while connected to the board.
- **⬜ planned** — decided on paper only, never verified. **Do not configure against a ⬜ row
  without eyes on the board first.**

Put the legend line directly under the table so the markers are self-explanatory to an agent that
opens only this file — the serial table in [`../../dh600/README.md`](../../dh600/README.md) is the
reference example. Claims outside tables get inline markers: `⚠ unverified` for anything not yet
checked, `(planned)` for decisions not yet executed.

A choice between hardware options is a `docs/decisions/NNNN-<slug>.md` entry in the craft's folder
(`CONVENTIONS.md` §5) with the frontmatter in `meta/scope-creep/docs/node-schema.md` (`kind`,
`status`, `date` with time, `supersedes`, `satisfies`). A changed plan is a new entry that
supersedes the old one; the old entry gets `status: superseded` and nothing else. `doc-indexer
search` drops superseded entries by default and tags the rest; `scope-creep serve` draws the
tree. Example chain: `drones/dh600/docs/decisions/`.

Only three things move a claim to ✅: a measurement, a config dump, or the user saying so. Editing
the surrounding prose is not evidence.

## Why

Agents hallucinate into vacuums. A doc with an empty channel-assignment slot invites an agent to
fill it with something plausible; a doc whose empty slots are *marked* unknown tells the agent the
gap is real and must be closed by measurement or by asking, not by inference. The markers also
make correction passes cheap: `grep -n '⬜\|unverified'` over a craft's docs lists everything that
still needs a bench check.

## Related

- Workspace rule: `CONVENTIONS.md` §10 (factual provenance).
- [param-files.md](param-files.md) — the `.param` dump is not the board; verify before committing.
- [ardupilot-build-standard.md](ardupilot-build-standard.md) — the shared radio/channel setup these
  tables should agree with.
