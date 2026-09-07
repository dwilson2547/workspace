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
- **Knowledge** — three scopes, all repo-local markdown: `docs/` for the workspace and the machines
  it runs on, `<domain>/docs/` for cross-project guidance in a domain, `<project>/docs/` for
  project-specific work. **There is no knowledge service** — `ai-notes-server`, `context-store`,
  `tool-docs`, `todo-store` and `workman` were tried and abandoned; do not reintroduce one. Obsidian
  as a knowledge tier is retired. Notes are written for *agents*, not human reading: atomic, and
  carrying `source:` when they distil a longer doc. Write with `meta/bin/wsnote` (enforces scope),
  read with `meta/SKILLS/doc-indexer` (`search` semantic, `find` literal, across every scope). Save at most
  one note per task, gated on "would this change how a future similar task is approached?" (§5).
- **Commits** — commit early, often, and broken; a commit is a checkpoint, not a certificate that
  something works. Messages record the *why*. Push freely. Committing and pushing here needs no
  per-request approval; history rewriting and branch deletion still do. **The only gate is secrets
  and credentials** — scan the diff, and if something is found, stop and unstage rather than
  planning to fix it in the next commit (§9).
- **Helm/Argo** — self-deploying project → `<project>/helm/<project>/`; shared/cluster-wide →
  `infra/cluster-config/` (§6).

- **First run on a machine** — two things live in `.git/config` and `~/`, so they cannot be
  committed and may be missing on a fresh clone. Check, and install if absent:
  ```bash
  git config --get core.hooksPath   # expect <workspace>/meta/bin/githooks
  ./meta/bin/install-git-guards.sh          # if it is not that
  ls ~/.claude/skills/doc-indexer           # expect a symlink into meta/SKILLS
  ./meta/SKILLS/install_skill_symlinks.sh   # if missing
  ```
  Full detail and the hooksPath interaction: [`SUBMODULES.md`](./SUBMODULES.md). The session-start
  git sync needs no setup — it is committed and path-independent.

Migration is opportunistic, not big-bang — see `CONVENTIONS.md` §8 for deferred debt.
