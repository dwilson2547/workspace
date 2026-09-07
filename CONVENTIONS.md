# Workspace Conventions

This is the **target-state** layout for the workspace superrepo. It is intentionally a
specification, not a migration plan — existing projects conform opportunistically (when you
touch them anyway), not in a big-bang move. New work conforms immediately.

The whole point of this document is to give the workspace a **single, closed namespace** so that
tooling — the AI notes layer, conformance checks, project placement — has something stable to key
off. Most of the historical organization pain came from not having this.

---

## 1. Nesting rule: compose systems, never file categories

```
workspace/                  ← the superrepo (this repo)
  <domain>/                 ← a PLAIN folder (never a submodule) — a category
    <project>/              ← a git submodule  OR  a plain reference folder
      <subsystem>/          ← plain dir in the SAME repo, if <project> is a composite system (§1a)
```

**Domain folders are never submodules.** They are plain directories committed to the superrepo.
Making the *category* a submodule is the parent→submodule→submodule mess that was removed once at
the root — do not reintroduce it. This is the only hard ban.

### 1a. Composite systems are monorepos, not nested submodules

A large system you run as one thing — a deployable product with its own orchestration (`helm/` /
`docker-compose.yml`) whose parts have no independent life — is built as a **monorepo**: a single
git repo (one submodule of the workspace) with its subsystems as plain internal directories.

`gyopart` is the canonical example: one repo holding `gyopart-api`, `gyopart-ui`,
`junkyard-inventory-scrapers`, `junkyard-platform`, and `parts-interchange` as directories, plus
the `helm/` that stands the whole thing up. There are **no submodules inside it.**

- **Prefer a monorepo** for any cohesive system. It avoids the submodule-of-submodules tangle
  entirely.
- **Nested submodules are a last resort,** justified only when a subsystem is genuinely
  versioned/published independently elsewhere — rare here, and currently used by nothing.
- A subsystem that belongs to a composite system lives **inside** that repo, never also as a
  standalone project at the workspace top level. The standalone predecessor gets archived (§8).

## 2. Repo (submodule) vs. plain folder

The deciding question, per existing practice: **can this stand up on its own?**

- **Submodule** — anything that could reasonably be cloned, run, or published independently: a
  service, an app, a library, a tool with its own lifecycle.
- **Plain folder** — reference material and one-offs with no independent lifecycle: the throwaway
  scripts in `tools/scripts/`, vendored docs, captured configs. These live *inside* a submodule
  (e.g. a `scripts` repo) or directly in a domain folder, but are not submodules themselves.

## 3. Naming

`kebab-case` for all domains and projects. No `snake_case`, no spaces. (Current tree mixes all
three — `obsidian-doc-puller` next to `obsidian_html_apps`; normalize on contact.)

---

## 4. Closed domain taxonomy

Every project belongs to **exactly one** domain — its *purpose*, not its *implementation*. A parts
scraper is `automotive` (what it's for), not `web-scrapers` (how it's built). New domains are not
minted ad hoc; adding one is a deliberate edit to this list.

**The tree has one axis: domain.** It is tempting to group by *scale* instead ("the big projects"
vs. the one-offs), but a directory tree can only partition on one axis, and scale is a gradient
with no fixed cutoff — projects drift across it as they grow, and you'd be moving folders forever.
So scale does **not** appear in the tree; it lives in metadata (§4a). Note that the largest tier is
already captured structurally: a "big project" is usually a **composite system** (§1a), and it
lives inside its domain like anything else — `gyopart` is a big project *in* `automotive/`, not in
a `projects/` bucket. There is deliberately no `projects/` domain.

| Domain | Scope | Current members (target home) |
|---|---|---|
| `ai/` | Agents, ML services, embeddings, image analysis | `ai_projects/*`, `dan-wiki` (embedding sandbox). `ai-notes-server` is **retired** (§5) → `archive/` |
| `embedded/` | Firmware, microcontrollers, CAN/DBC, RTK, sensors | `microcontroller-projects/*`, `sensor-transposition`. CAN/DBC projects (`dbc-forge`, `can-simulator`, `phone-dbc-repo`, `ESP32RET`) live here, tagged `automotive` (§4b) |
| `robotics/` | Robot services, SLAM, scanners, data capture | `robo-services`, `terrestrial-scanner`, future SLAM rig |
| `drones/` | UAV/multirotor craft, parts inventory, build & flight logs | `x500` (PX4 dev quad), `pavo20-pro-2` (FPV cinewhoop), `inventory` (parts) |
| `automotive/` | Vehicle parts data, interchange, part scrapers | `gyopart` (monorepo: api, ui, junkyard-inventory-scrapers, junkyard-platform, parts-interchange), standalone rockauto/partsgeek/autoevolution/parts-direct scrapers |
| `web-scrapers/` | General scraping framework + non-automotive scrapers | `scrape-stack`, `scrape-job-manager`, `imdb-web-scrape` |
| `media/` | Media library & photo management apps | `media-apps/*`, `photo-dump` |
| `messaging/` | Pub/sub, streaming experiments & tools | `pub_sub/*` |
| `infra/` | k8s, ArgoCD, baseline Helm, Docker, CI tooling | `cluster-config`, `helm`, `dockers`, `desktop-jenkins` |
| `tools/` | Standalone utilities, CLIs, browser/editor extensions, one-off scripts | `scripts`, `auto-dbms-from-sql`, `cronjob-manager`, `chrome-extensions`, `obsidian-plugins/*`, `potree` |
| `apps/` | End-user GUI/desktop/web apps | `task-queue-manager` |
| `meta/` | Agent skills, workspace conventions, knowledge tooling | `SKILLS`, `bin/wsnote`, `doc-indexer`, plus the documentation tooling relocated out of the old top-level `docs/` (`markdown-api`, `markdown-renderer`, `sidebar-generator`) |
| `private/` | Personal projects kept out of public view. Deliberate §2 exception: the domain folder holds a single **private container submodule** (one private remote) and projects live as plain folders inside it, so nothing about them appears in this public repo. Contents are documented only inside that private submodule | *(private)* |
| `experiments/` | POCs and sandboxes kept for reference | `pocs/*`, `testing/*` |
| `archive/` | Superseded / dead, kept for history only. **Mirrors the taxonomy one level down** — `archive/<domain>/<project>` (§4c) | `automotive/` (gyopart predecessors, standalone rockauto scrapers), `web-scrapers/` (the old monorepo + cache/permit services absorbed into scrape-stack), `meta/` (the retired knowledge stack, §5), `apps/`, `embedded/` |

**`docs/` is not a domain.** It has never appeared in this table, and must not be added to it. At
every level of the tree — workspace root, domain, project — `docs/` means the knowledge layer and
nothing else (§5). The top-level `docs/` folder holding `markdown-api`, `markdown-renderer`,
`sidebar-generator`, `wiki` and `auto-doc` predates this list and is non-conforming; §8 tracks its
dissolution. No project may live in a `docs/` folder.

Settled: `embedded` and `robotics` stay **separate** (the SLAM rig and scanners want a robotics
home distinct from firmware). `potree` → `tools`. One call left open: `dan-wiki` is placed in `ai`
as an embedding sandbox.

### 4a. Scale is metadata, not a folder

To make the scale/scope you think in terms of *visible* without warping the tree, each project's
`README` frontmatter carries a `tier`:

```yaml
tier: system      # composite product you run (gyopart, robo-services, junkyard-inventory)
tier: project     # a normal standalone project (most things)
tier: experiment  # POC / sandbox, may be discarded
tier: reference   # one-offs kept for reference, no lifecycle (scripts, captures)
```

This lets you list "the big boys" any time (`grep -r 'tier: system'`) without a `projects/`
folder. `tier: system` lines up with the §1a composite-system test.

### 4b. Cross-cutting projects: one home, many tags

Some projects straddle domains (CAN/DBC tooling is both `embedded` and `automotive`; it ships an
Android app too). The rule:

- **Folder = single home, chosen by primary purpose.** Ask "what was I trying to accomplish?" —
  delivery surfaces (an Android app, an ESP32 board) are *implementation*, not purpose. CAN/DBC's
  home is `embedded`.
- **Secondary domains are `domains:` frontmatter on notes (§5),** which is multi-valued. A note
  about a DBC project filed under `embedded` carries `domains: automotive`, so `wsnote` retrieval
  finds it from either angle. The tree stays single-home; the *knowledge* is multi-domain.

### 4c. `archive/` mirrors the taxonomy

Dead projects live at `archive/<domain>/<project>`, using the same closed domain list as the live
tree. This is §4a's rule applied one level down: the tree partitions on **one** axis, and "dead" is
already expressed by being in `archive/` at all. *When* something was archived and *why* are
metadata — they belong in `archive/README.md`, not in folder names. Archiving by year or by reason
would partition on a second axis and reproduce the problem §4a exists to prevent.

- Create a domain folder under `archive/` only when something lands in it. Empty mirrors are noise.
- Record every archival in `archive/README.md`: what it was, why it died, and what replaced it. An
  archived project with no recorded reason decays into a mystery — the same failure the `source:`
  field prevents for notes (§5).
- **Restructuring `archive/` is exempt from the opportunistic-migration rule (§8).** That rule
  exists because moving *live* projects breaks things that depend on their paths. Archive has no
  dependents by definition — nothing imports from a dead repo and `doc-indexer` skips the tree
  wholesale — so a single pass is lower risk than living with two layouts.
- Deleting is allowed. A submodule whose remote still exists loses nothing by being deregistered;
  record the removal and the remote in `archive/README.md` rather than keeping a mapping alive out
  of principle.

---

## 5. Knowledge layout (three scopes, one access path)

All knowledge in this workspace is **repo-local markdown**. There is no knowledge service, no
daemon, and no API. This is a deliberate reversal: `ai-notes-server`, `context-store`, `tool-docs`,
`todo-store` and `workman` were all tried and **abandoned** — five overlapping services created more
problems than they solved. Do not reintroduce a knowledge service. If something is missing, extend
the two CLIs below.

The audience for this layer is **agents, not humans**. Notes are written to be retrieved and acted
on by an agent answering a question or making a decision; they are not a personal wiki and are not
read in Obsidian. Write them accordingly: atomic, factual, self-contained.

### The three scopes

Knowledge is scoped *structurally* — by where it sits in the tree. An agent working under
`robotics/` reads `robotics/docs/` and cannot be polluted by another domain's knowledge.

```
docs/                  ← workspace scope: true of the workspace itself or the machines it runs on
  machines/            ← dev/workstation triage (hardware, kernel, driver, display stack)
  topics/              ← long-form workspace-wide references
  patterns/            ← patterns that genuinely cross domains
  notes/               ← atomic agent notes, workspace scope
  wiki/                ← legacy content submodule, pending triage (§8)
  auto-doc/            ← legacy generated content submodule, pending triage (§8)

<domain>/docs/         ← domain scope: cross-project guidance within one domain
  topics/  patterns/  notes/

<project>/docs/        ← project scope: specific to one project
  issues/              ← YYYY_MM_DD_<slug>.md   (issue-documentation skill writes here)
  decisions/           ← architectural decisions, why-not records
  patterns/  notes/
```

`docs/` means **exactly one thing at every level: the knowledge layer.** It is not a domain and
never appears in the §4 taxonomy. **No project may live in a `docs/` folder at any level** — if it
can be cloned, run or published on its own (§2), it belongs in a domain.

A *content* submodule is not a project: `docs/wiki` and `docs/auto-doc` are prose and generated
markdown with no build and no lifecycle, so the knowledge layer is their correct home. The test is
§2's — "can this stand up on its own?" — not whether it happens to be a submodule.

### Admission rule for workspace-scope `docs/`

The other two scopes are protected by the tree — `robotics/docs/` can only be reached from
`robotics/`. Workspace `docs/` has no such protection: it is visible from everywhere, so without a
rule it becomes the default dumping ground for anything ambiguous.

> Workspace `docs/` holds only knowledge true of **the workspace itself or the machines it runs
> on** — dev machine triage, repo conventions, toolchain gotchas that genuinely span domains.
> If a fact belongs to one domain, it goes in that domain. **"I couldn't decide" is not an
> admission criterion.**

When in doubt, push knowledge *down* to the narrowest scope that fits. A fact in the wrong domain
folder is a minor annoyance; a workspace `docs/` that has become `misc/` is a dead layer.

### Notes format

One fact per file with frontmatter (`title:`, `date:`, `tags:` comma-separated, optional `domains:`
for secondary domains per §4b and optional `source:`), body of 2–5 sentences. Every `docs/notes/`
folder keeps a one-line-per-note `README.md` index so agents can survey cheaply before opening
files.

**Notes are a context-economy layer, not a lesser doc.** A note exists so an agent can act on a
fact without loading a full root-cause analysis into context. Two kinds qualify: something too
small to warrant a triage doc, and a distillation of one that does.

**`source:` — for the distilled kind.** When a note summarises a longer document, record that
document's workspace-relative path:

```yaml
source: docs/machines/2026_09_06_nvidia_module_missing_hdmi_not_detected.md
```

A derived artifact with no pointer to its origin drifts silently: correct the analysis and the
summary keeps confidently asserting the old version. `source:` gives an agent a path to escalate
when the note is not enough, and gives a correction pass a trail to follow. It is **optional** —
plenty of notes distil nothing — but omitting it on a note that *does* summarise a doc is a defect,
not a shortcut. `wsnote search` and `wsnote ls` surface it in their output.

Backlogs are `TODO.md` at the project root (checkboxes, priority sections) — not a service.

### Access: two CLIs, one read path

- **`meta/bin/wsnote`** — the *writer*. `add` / `search` / `ls` / `reindex`, scoped to a domain or
  project. Pure stdlib, lexical, no daemon. Use it to record a note in the right scope. Workspace
  scope is the target `.` — `wsnote add . "Title" "Body" --tags a,b` writes to `docs/notes/`;
  `reindex` discovers every scope including root with no special casing.
- **`meta/SKILLS/doc-indexer`** — the *reader*. One point of access to every markdown file in the
  workspace, regardless of scope: `index <base-dir>` (recursive scan, incremental re-index),
  `search <query>` (semantic), `find <text>` (literal). Results carry the document path, so an
  agent can judge domain relevance from the path itself.

The split is deliberate: `wsnote` enforces *where knowledge goes*, `doc-indexer` removes the need to
know where it went in order to find it. Re-run `doc-indexer index` after writing notes.

### Save gate (unchanged)

At most one note per task, and only if it passes:

> Would this change how a *future, similar* task is approached?

A cross-project pattern, a non-obvious toolchain gotcha, or an architectural decision passes. A
renamed variable, a routine fix, or anything findable in official docs fails.

---

## 6. Helm / ArgoCD placement (codified from current practice)

This already works with the argocd-k8s skill; documented so it stays consistent.

- **Shared cluster infra & Argo apps** → `infra/cluster-config/`
  - `argocd/` — Application/ApplicationSet manifests
  - `<category>/` — shared services (`monitoring/`, `postgres/`, `dns/`, …)
- **Self-managed project charts** → `<project>/helm/<project>/Chart.yaml`
  - Argo references these in place. Uniform across `robo-services`, `gyopart`, `pub_sub/*`.

Rule: a project that owns its deployment ships its chart under its own `helm/`; anything
cluster-wide or cross-project lives in `infra/cluster-config/`.

---

## 7. Conformance

A future `meta/` checker will flag drift. Until then, a project conforms when:

- [ ] It sits under exactly one taxonomy domain folder.
- [ ] It is a submodule (standalone or a composite-system monorepo, §1a) or a justified plain
      reference folder. It is **not** a submodule containing other submodules.
- [ ] `kebab-case` name.
- [ ] Has a `README` (with a `tier:` marker, §4a) and a `docs/` directory (§5).
- [ ] If it self-deploys: chart at `helm/<project>/`.
- [ ] If it's a runnable app/service/game (not a library or one-off script): ships a start script
      and a kill/stop script at the project root (e.g. `start.sh`/`stop.sh` or
      `startup.sh`/`kill.sh`), so it can be launched and torn down directly for manual testing
      without re-deriving the exact incantation each time or depending on an IDE's embedded run
      panel (which can silently fail to forward input in some environments — e.g. Godot's
      embedded Game panel under WSL2).
- [ ] No stray cruft (`:Zone.Identifier` files, abandoned duplicate variants).

---

## 8. Known migration debt (deferred, do not action from this doc)

- ~~`gyopart/` relocate under `automotive/`~~ — **done.** Lives at `automotive/gyopart`. Do **not**
  decompose it or reintroduce submodules.
- ~~Archive the standalone `gyopart` predecessors~~ — **done.** `parts-interchange`,
  `junkyard-inventory-scrapers` and `parts-direct` are at `archive/automotive/`, each reconciled
  against the monorepo copy first and documented in `archive/README.md`.
- ~~Three `task-queue-*` variants → keep `task-queue-manager`~~ — **done.** `task-queue-manager`
  is live at `apps/`; `task-queue-app` and `task-queue-app-electron` are at `archive/apps/`.
- 38 `:Zone.Identifier` Windows files committed → strip.
- README coverage is 49/60 git projects → backfill on contact.
- ~~Restructure `archive/` by domain~~ — **done 2026-09-06** (§4c). 24 projects moved into
  `automotive/`, `web-scrapers/`, `meta/`, `apps/`, `embedded/`; 21 submodule paths rewritten with
  `.gitmodules` and `.git/config` section names realigned. `legacy` was deregistered outright — no
  value, and the remote survives at `git@github.com:dwilson2547/legacy.git` @ `aae1e7a`.
- ~~Retire the abandoned knowledge-service skills~~ — **done 2026-09-06.** The service repos had
  been archived long ago, but their five skills were still installed and actively directing agents
  at `localhost:8001` and friends, contradicting §5. Moved to `meta/SKILLS/archive/`, dropped from
  the installer's explicit mappings, symlinks removed from `~/.claude/skills` and `~/.agents/skills`.
  Fixed a syntax error in `install_skill_symlinks.sh` (a stray line-continuation swallowing a `do`)
  that had left the script non-functional since `59b8f40`.
- ~~Dissolve the top-level `docs/` folder~~ — **done 2026-09-06.** It was a topic-grouping, never a
  domain (it never appeared in the §4 table). `markdown-api`, `markdown-renderer` and
  `sidebar-generator` moved to `meta/` as knowledge tooling, with `.gitmodules` and `.git/config`
  section names realigned to their new paths. `wiki` and `auto-doc` stayed put: they are *content*,
  not projects (§5), so the knowledge layer is already their correct home. `docs/` now means the
  knowledge layer at every level of the tree.
- ~~Create the workspace knowledge layer, move `infra/workstation/` → `docs/machines/`~~ —
  **done 2026-09-06.** `infra/` is back to deployable systems only.
- **Triage `docs/wiki`** — the original personal wiki: large, half-built, many empty pages created
  as scaffolding that was never filled. Needs a deliberate pass to keep what earns its place and
  delete the rest, not a bulk move. Until then its contents are unverified and should be weighted
  accordingly when `doc-indexer` surfaces them. **This is a working session with a human, not an
  agent task** — the judgement about what is worth preserving is not automatable.
- **Triage `docs/auto-doc`** — generated output from an occasional-use GitHub Q&A tool; useful to
  keep, poorly organised by nature. Lower priority than the wiki. Consider whether the generator
  should write into a structured path rather than reorganising its output after the fact.
- The Obsidian vault as a knowledge tier is **retired**, not deferred (§5). Nothing migrates to it.
  Human-prose material that still exists in-repo (`wiki`, `auto-doc`) stays in-repo so
  `doc-indexer` can reach it.

---

## 9. Commit policy

**Commit early, commit often, commit broken.** A commit is a checkpoint in a narrative, not a
certificate that something works. The earlier practice — get it working locally, *then* commit — was
optimising for a tidy history of working states. That is the wrong trade: it produces sparse commits
with no record of the reasoning between them, and the reasoning is the part a diff cannot
reconstruct.

- **Do not gate a commit on the code working.** WIP, half-finished refactors, failing tests, dead
  ends later reverted — all legitimate commits. A dead end that got recorded is cheaper than one
  rediscovered.
- **Write the *why*, not the *what*.** The diff already states what changed. A message earns its
  place by recording intent, the alternative rejected, the constraint discovered, or the symptom
  being chased. One dense paragraph beats a bullet list restating the file names.
- **Push freely.** Unpushed work is work that exists on one machine. `meta/bin/wsgit-status` reports
  this at session start precisely because it is a failure mode worth surfacing.
- **Agents may commit and push in this workspace without asking each time.** This section is the
  standing authorization. It does not extend to history rewriting (`push --force`, rebase of pushed
  commits, `filter-branch`) or to deleting branches — those still require a direct request.

### Commit and push as you go — never bank work

**Do not end a task with a dirty working tree.** This is the rule the rest of §9 exists to make
possible: if commits are cheap and ungated, there is no reason to accumulate.

The failure it prevents is specific and has happened in every environment here. An agent does a
day's work without committing, then another does more on top. Within a day or two the tree holds a
pile of unattributable changes — no messages, no boundaries, no way to tell which edit belonged to
which intent. The only options left are archaeology or discarding the lot, and in practice it gets
discarded. Work is lost not because anything broke but because nobody could say what it was for.

- **Commit at each meaningful step**, not once at the end. A task that produced five distinct
  changes should produce roughly five commits.
- **Push before the session ends.** Unpushed work exists on exactly one machine.
  `meta/bin/wsgit-status` reports this at session start for that reason.
- **Nothing is "not ready enough to commit."** §9 does not gate on working code — commit the
  unfinished state and say in the message what is unfinished. A WIP commit is recoverable; an
  uncommitted tree is not.
- **If you find an orphaned change you did not make**, do not absorb it into your own commit and do
  not leave it. Reconstruct what it was from the diff — such changes are usually more
  self-documenting than they first appear — and commit it separately so it keeps its own history.
  If it genuinely cannot be reconstructed, say so and ask rather than bundling it.

### Enforced, not advisory

The rules above are enforced by a `pre-commit` hook wired into the superrepo and every submodule
via `core.hooksPath` (`meta/bin/githooks/`, installed by `meta/bin/install-git-guards.sh` — re-run
it after adding a submodule). Guidance alone did not work; these are the failures it now blocks
outright:

1. **Detached HEAD.** A commit there is on no branch and is silently lost at the next checkout or
   submodule update. This is the default state of a freshly checked-out submodule, which is exactly
   why it keeps happening.
2. **Behind upstream.** Committing on a stale base is what manufactures the conflicts. The hook
   compares against the last fetched refs and tells you the sequence that works from where you are
   standing — including `git stash` first, since `git pull` refuses to run with staged changes.
3. **Secrets.** The gate below, applied to staged content.

`WSGIT_SKIP=1 git commit …` overrides for a single commit; use it for a false positive, not to get
past a real one.

### The repo is current before work starts

Blocking at commit time is the wrong end of the problem — the work is already done and paid for.
`meta/bin/wsgit-status` runs from a **SessionStart hook** (`.claude/settings.json`) and, before the
first prompt is answered:

1. fetches the superrepo and all 86 submodules in parallel (~9s),
2. **fast-forwards** everything it can do so safely — clean tree, no unpushed commits, no
   divergence. A fast-forward under those conditions cannot lose work.
3. reports only what it could not handle: dirty, diverged, detached-with-commits, or no upstream.

So the normal case needs no decision from anyone. The pre-commit guard above is the backstop for
drift during a long session, not the primary mechanism, and should now rarely fire.

`WSGIT_NO_PULL=1` fetches and reports without moving anything.

**Portable by construction.** Nothing here hardcodes a path. The hook command is
`"$(git rev-parse --show-toplevel)/meta/bin/wsgit-status"`, and the script derives the workspace
root from its own location via `readlink -f "${BASH_SOURCE[0]}"` rather than a literal path — so
both work from any clone, at any path, on any machine. `.claude/settings.json` is committed
(`settings.local.json` stays ignored, which is the distinction the ignore rule was reaching for).

The one part that cannot travel is `core.hooksPath` for the pre-commit guard: it lives in
`.git/config`, which is never committed. Run `meta/bin/install-git-guards.sh` once per clone — the
installer travels even though the config cannot, the same way `husky` or a `make bootstrap` works.

**Auto-pulling a submodule changes the superrepo's recorded pointer**, so a sync that advances one
leaves the superrepo dirty with a legitimate pointer bump to commit. That is real state, not noise —
but it does mean a session can start with a dirty tree it did not create.

This tool previously did none of this: it skipped submodule fetches for speed, only printed advice,
and — the actual reason nothing ever worked — **was never wired to any hook at all**, despite its
own header claiming it ran at session start. It had never run once.

### The one gate: secrets and credentials

This is the only check that blocks a commit. Before staging, scan the diff for:

- `.env` files, private keys (`*.pem`, `*.key`, `id_rsa`, `id_ed25519`), `.netrc`, `.npmrc` with
  tokens
- API keys, bearer tokens, passwords, and connection strings carrying credentials
  (`postgres://user:pass@…`)
- kubeconfigs with embedded certs or tokens, cloud credential files (`~/.aws/credentials`)
- anything under `private/` leaking into a public-remote repo

If something is found: **stop, unstage it, and say so.** Do not commit it intending to fix it in the
next commit. A secret that reaches history is leaked — remediation is credential rotation plus a
history rewrite, not a follow-up commit. This holds even for a repo believed to be private, because
repo visibility can change and history outlives the assumption.

**Submodules:** the superrepo commit records a pointer; the content commit happens inside the
submodule. The gate applies at **both** levels, and the submodule is where the secret would actually
land.
