# docs — workspace knowledge layer

Workspace-scope knowledge: facts true of **the workspace itself or the machines it runs on**.
Domain-specific knowledge belongs in `<domain>/docs/`; project-specific knowledge in
`<project>/docs/`. See `CONVENTIONS.md` §5 for the full layout and the admission rule.

> If a fact belongs to one domain, it goes in that domain.
> **"I couldn't decide" is not an admission criterion.**

## Layout

| Path | Holds |
|---|---|
| `machines/` | Dev machine triage — hardware, kernel, driver, display stack. Dated records. |
| `topics/` | Long-form references that genuinely span domains. |
| `patterns/` | Reusable shapes that recur across domains. |
| `notes/` | Atomic agent notes, workspace scope. Index in `notes/README.md`. |

## Legacy content (pending triage)

| Path | What it is |
|---|---|
| `wiki/` | The original personal wiki. Large, half-built, many empty pages. Slated for a deliberate pass: preserve what earns its place, delete the rest. Not yet triaged — treat its contents as unverified. |
| `auto-doc/` | Generated output from an occasional-use GitHub Q&A tool. Poorly organised by nature. |

Both are content, not projects, so they belong in the knowledge layer rather than a domain — but
neither has been through a quality pass. `doc-indexer` reaches them; weigh them accordingly.

## Access

```bash
wsnote add . "Title" "Body" --tags a,b     # write a workspace-scope note ('.' = root)
doc-indexer search "<query>"               # semantic search across ALL scopes
doc-indexer find "<text>"                  # literal search across ALL scopes
```
