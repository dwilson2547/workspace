# Workspace

Superrepo holding the bulk of my code, grouped by domain. This file is read up the directory tree,
so it applies even when you're working deep inside a submodule.

## Wrong-chat check

Before acting on a request that's sharply discontinuous with what this channel has been about — a
different project/domain than the working directory, or one that assumes prior state this session
has no trace of ("the bug we discussed", "continue where we left off") — pause, say
"⚠️ wrong chat? this looks like <X>" in one line, and wait for confirmation before doing anything.
Don't absorb a hard left-field drop and pivot seamlessly; let me redirect it first.

Do NOT flag: meta/workflow requests (commit, status, push), legitimate cross-cutting work, or a new
task I've clearly started on purpose.

## Operating rules

This workspace has a **closed structure and knowledge convention**. Follow the
**`workspace-conventions` skill**, which is the behavioral layer over the full spec in
[`CONVENTIONS.md`](./CONVENTIONS.md). If the skill isn't loaded, read `CONVENTIONS.md` directly.

The essentials (full detail in `CONVENTIONS.md`):

- **Placement** — one domain per project by *purpose* (closed taxonomy, §4); `kebab-case`;
  submodule if it stands up on its own, else a plain folder (§2); domain folders are never
  submodules; nest submodules only for a composite system you run (§1/§1a); no `projects/` folder —
  scale is a `tier:` README marker (§4a); cross-cutting projects get one home + secondary-domain
  tags (§4b).
- **Knowledge** — per-project notes in `<project>/docs/`; human prose in Obsidian; cross-cutting
  reusable knowledge in the AI notes server, **namespaced by domain**. Recall before non-trivial
  domain work; save at most one note per task, gated on "would this change how a future similar
  task is approached?" (§5). Mechanics: `ai-notes-server` skill.
- **Helm/Argo** — self-deploying project → `<project>/helm/<project>/`; shared/cluster-wide →
  `infra/cluster-config/` (§6).

Migration is opportunistic, not big-bang — see `CONVENTIONS.md` §8 for deferred debt.
