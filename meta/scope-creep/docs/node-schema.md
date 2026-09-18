---
tier: reference
domain: meta
---

# Node schema

A node is one markdown file in a project's `docs/decisions/`, named `NNNN-<slug>.md`. The number is
the node's id within the project; `scope-creep new` picks the next one. The frontmatter is the
graph, the body is for reading.

```yaml
---
kind: decision                     # requirement | constraint | decision | outcome
status: accepted                   # see table
date: 2026-09-17T13:26:08-04:00    # when it was decided or recorded; ISO 8601 with zone
supersedes: 0002                   # decision → the decision it replaces (same project, or path#NNNN)
superseded_by: 0004                # written onto the old entry by `scope-creep new --supersedes`
satisfies: [0001, 0005]            # decision → requirement/constraint ids it serves
depends_on: [0003]                 # decision → earlier decisions it builds on
resolves: 0001                     # outcome → the requirement/constraint it closes
source: b049983                    # optional: commit, doc, or discussion this entry distils
---

# 0003 — Title
```

| kind | what it is | statuses |
|------|------------|----------|
| requirement | something the project must do | `open`, `done` |
| constraint | something the project may not do or cannot have | `open`, `satisfied` |
| decision | a choice between options; the options live in the body | `proposed`, `accepted`, `rejected`, `superseded` |
| outcome | the measurement, dump, or user confirmation that closes a requirement | `verified` |

`date` is required and is the timestamp of record. Git history is read as well, but a file's own
date wins, because commits are not always made when the decision is.

## What is derived, never written

- **Dead branches.** A node is dead if its status is `rejected` or `superseded`, or if every
  decision it `depends_on` is dead. That is how an abandoned line of design shows up as a whole
  extinguished branch without anyone editing the leaves.
- **Rollups.** A requirement or constraint reports how many nodes serve it, how many are live,
  and which live node closes it (an `outcome` that `resolves` it, or an `accepted` decision that
  `satisfies` it).
- **Status history.** Each commit that changed the file's status is listed with its date.
- **The tree.** A node's parent is its first existing `resolves`, `satisfies`, or `depends_on`
  target. `supersedes` is a lateral edge drawn between siblings, not a parent.

## The one edit an old entry receives

When a decision is superseded, its `status` becomes `superseded` and it gains `superseded_by`.
Nothing else in it changes, ever. `scope-creep new --supersedes NNNN` does this.

## Legacy files

A file with no frontmatter is read as a `decision`; `**Status:** … · **Date:** …` in the header
supplies status and date, and "superseded by NNNN" in the status supplies the edge. `scope-creep
scan` flags these. Convert when you touch them.
