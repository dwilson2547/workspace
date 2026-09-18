---
kind: decision
status: accepted
date: 2026-09-17T23:50:33-04:00
---

# 0001 — The graph is the markdown files; the app only derives and renders

## Context

The idea started as "represent each decision as a node, with the alternatives below it and the
chosen path continuing the chain", and grew to requirements, constraints and a solved state. Two
storage options came up: a JSON Canvas or similar document, and a database the agent logs to.

## Options

- A database or canvas file the app owns, written to by agents. Needs every agent to remember a
  side channel. The workspace already abandoned four tools built this way (`CONVENTIONS.md` §5).
- The existing `docs/decisions/` files with a small frontmatter, parsed on every load. The write is
  on the path the agent already walks: same folder as the README, same commit, same diff, same
  `doc-indexer` index.

## Decision

Files. `scope-creep` stores nothing. Edges, dead branches, rollups and the tree are derived on
load; status history comes from git; `date` lives in the file because commits are not always
made when the decision is. Search reuses `doc-indexer`'s index rather than a second embedding
store.

## Consequences

- Any editor, any agent, any tool can add a node. Enforcement is one line in an agent prompt.
- A wrong derivation is fixed in one place and every project's view updates.
- Rendering re-parses on each request. Fine at hundreds of nodes; revisit past thousands.
