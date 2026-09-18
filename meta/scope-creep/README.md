---
tier: tool
domain: meta
domains: apps
---

# scope-creep

A project's requirements, constraints, decisions and outcomes drawn as a timeline tree you can
zoom. Zoomed out: the requirements and what state they are in. Zoomed in: every decision under
each, the options it weighed, the ones that were rejected, and the branches that died when an
earlier choice was overturned. The x axis is time.

The files are the graph. Every node is a markdown file in some project's `docs/decisions/`
(`CONVENTIONS.md` §5) with a few frontmatter fields, see [`docs/node-schema.md`](docs/node-schema.md).
There is no database. The app parses the files, derives edges and dead branches, reads git for
status history, and serves a view. Search reuses `doc-indexer`'s index and embeddings when it is
installed, literal matching when it is not.

## Use

```bash
scope-creep scan                                  # every node under the workspace, dead ones marked †
scope-creep graph --project drones/dh600          # the graph as JSON
scope-creep new drones/dh600 decision "Gimbal on TELEM3" --satisfies 0004 --supersedes 0003
scope-creep serve                                 # http://127.0.0.1:8765
```

`serve` needs the UI built once:

```bash
cd meta/scope-creep/ui && npm install && npm run build
```

Everything else is Python 3 stdlib.

## In the view

- Colour is status. Green accepted, blue done or verified, grey proposed or open, red rejected,
  dim red superseded. A dead branch is desaturated as a whole.
- Zoom out past half scale and only requirements and constraints remain, each with its live/dead
  count. Zoom in past double scale and node bodies appear.
- Search box: semantic when `doc-indexer` is on the path. Chips filter the hits to accepted,
  rejected, or all; non-hits fade rather than vanish so the shape of the tree stays.
- Click a node for its full body, its status history from git, and its links.

## Why not a database

The abandoned `ai-notes-server` / `context-store` / `workman` stack (`CONVENTIONS.md` §5) failed
because a separate store needs the agent to remember to write to it. A file next to the README the
agent is already editing lands in the same commit, the same diff, and the same index. See
`docs/decisions/0001`.
