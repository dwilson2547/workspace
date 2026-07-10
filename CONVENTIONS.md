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
| `ai/` | Agents, ML services, embeddings, image analysis | `ai_projects/*`, `ai-notes-server`, `dan-wiki` (embedding sandbox) |
| `embedded/` | Firmware, microcontrollers, CAN/DBC, RTK, sensors | `microcontroller-projects/*`, `sensor-transposition`. CAN/DBC projects (`dbc-forge`, `can-simulator`, `phone-dbc-repo`, `ESP32RET`) live here, tagged `automotive` (§4b) |
| `robotics/` | Robot services, SLAM, scanners, data capture | `robo-services`, `terrestrial-scanner`, future SLAM rig |
| `automotive/` | Vehicle parts data, interchange, part scrapers | `gyopart` (monorepo: api, ui, junkyard-inventory-scrapers, junkyard-platform, parts-interchange), standalone rockauto/partsgeek/autoevolution/parts-direct scrapers |
| `web-scrapers/` | General scraping framework + non-automotive scrapers | `scrape-stack`, `scrape-job-manager`, `imdb-web-scrape` |
| `media/` | Media library & photo management apps | `media-apps/*`, `photo-dump` |
| `messaging/` | Pub/sub, streaming experiments & tools | `pub_sub/*` |
| `infra/` | k8s, ArgoCD, baseline Helm, Docker, CI tooling | `cluster-config`, `helm`, `dockers`, `desktop-jenkins` |
| `tools/` | Standalone utilities, CLIs, browser/editor extensions, one-off scripts | `scripts`, `auto-dbms-from-sql`, `cronjob-manager`, `chrome-extensions`, `obsidian-plugins/*`, `potree` |
| `apps/` | End-user GUI/desktop/web apps | `task-queue-manager` |
| `meta/` | Agent skills, workspace conventions, knowledge tooling | `SKILLS` |
| `private/` | Personal projects kept out of public view. Deliberate §2 exception: the domain folder holds a single **private container submodule** (one private remote) and projects live as plain folders inside it, so nothing about them appears in this public repo. Contents are documented only inside that private submodule | *(private)* |
| `experiments/` | POCs and sandboxes kept for reference | `pocs/*`, `testing/*` |
| `archive/` | Superseded / dead, kept for history only | `legacy`, `wiki_demo`, dead `task-queue-app{,-electron}`, `instructions` & `tool_wikis` (after fold-in) |

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

---

## 5. Knowledge layout (two tiers)

Each tier has one home; nothing else is a knowledge home. The historical sprawl —
`instructions/`, `tool_wikis/`, `wiki_demo/`, `dan-wiki`, ad-hoc READMEs, and the retired
service stack (ai-notes-server → context-store → workman notes/playbooks/todos) — collapses
into these.

**Tier 1 — Repo-local docs (domain and project).** Docs that live with the code in this workspace.
This is the agent knowledge layer: it travels with every clone, needs no running service, and is
scoped *structurally* — an agent working under `robotics/` reads `robotics/docs/`, and cannot be
polluted by another domain's knowledge.

Use domain docs for cross-project guidance in a domain, and project docs for project-specific work.
Examples: general ESP32 notes belong in `embedded/docs/`; project-specific code workarounds belong in
that project's `docs/`.

```
<domain>/docs/
  topics/      ← domain-wide references and guidance used by multiple projects (long-form)
  patterns/    ← reusable domain patterns
  notes/       ← atomic agent notes (frontmattered facts; managed by `wsnote`)
```

```
<project>/docs/
  issues/      ← YYYY_MM_DD_<slug>.md   (issue-documentation skill writes here)
  decisions/   ← architectural decisions, why-not records
  patterns/    ← reusable shapes discovered in this project
  notes/       ← atomic agent notes scoped to this project
```

Backlogs are `TODO.md` at the project root (checkboxes, priority sections) — not a service.

**Notes** are one fact per file with frontmatter (`title:`, `date:`, `tags:` comma-separated,
optional `domains:` for secondary domains per §4b), body of 2–5 sentences. Every `docs/notes/`
folder keeps a one-line-per-note `README.md` index so agents can survey cheaply before opening
files. The **`meta/bin/wsnote`** CLI handles `add` / `search` / `ls` / `reindex` — pure stdlib,
lexical search, no daemon. Save gate is unchanged: at most one note per task, only if it would
change how a future similar task is approached.

**Tier 2 — Human cross-cutting (Obsidian vault).** Prose docs, design notes, anything you read as a
human. Single source of truth; synced across devices by Obsidian, not by this repo. `wiki_demo`,
`instructions`, and `tool_wikis` migrate here and are then archived.

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
- [ ] Has a `README` (with a `tier:` marker, §4a) and a `docs/` directory (Tier 1).
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

- `gyopart/` is now a true monorepo (§1a); relocate it under `automotive/` as-is. Do **not**
  decompose it or reintroduce submodules.
- The standalone predecessor repos consolidated into the `gyopart` monorepo
  (`parts-interchange`, `junkyard-inventory-scrapers`, `junkyard-platform`, `gyopart-api`,
  `gyopart-ui`) → move to `archive/` with a note that they were consolidated under `gyopart`. The
  top-level `parts_interchange` submodule is the live local instance of this.
- Three `task-queue-*` variants → keep `task-queue-manager`, archive the rest.
- 38 `:Zone.Identifier` Windows files committed → strip.
- README coverage is 49/60 git projects → backfill on contact.
