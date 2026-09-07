# Working in this submodule-heavy layout

This workspace is a superrepo of ~50 git submodules (see [`CONVENTIONS.md`](./CONVENTIONS.md) for the
structure). The recurring hazard with that layout: **git commands act on whichever repo your `cwd`
resolves to, and submodule boundaries are invisible** — so it's easy to think you're in `workspace`
when you're actually inside `automotive/gyopart`, and a commit lands in the wrong repo.

The fixes below make the active repo *visible* and stamp the commit *target* into every commit
message. They live in machine-local files (`~/.bashrc`, `~/.git-hooks`), **not** in the repo, so
**apply them once per machine** — this doc is the reproducible source.

---

## 1. Show the active repo in the prompt

Append to `~/.bashrc` (also available ready-to-copy as [`bashrc.example`](./bashrc.example)). Your
prompt then ends with `(workspace@main)` or `(submodule:gyopart@main)`, so you always know which
repo a git command will hit.

```bash
# --- submodule-aware git context in prompt ---
__git_ctx() {
  local top br super name
  top=$(git rev-parse --show-toplevel 2>/dev/null) || return
  name=$(basename "$top")
  br=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
  super=$(git rev-parse --show-superproject-working-tree 2>/dev/null)
  if [ -n "$super" ]; then printf ' (submodule:%s@%s)' "$name" "$br"
  else printf ' (%s@%s)' "$name" "$br"; fi
}
PROMPT_COMMAND="__gc=\$(__git_ctx)${PROMPT_COMMAND:+; $PROMPT_COMMAND}"
PS1="${PS1/'\$ '/'${__gc}\$ '}"
```

`--show-superproject-working-tree` is what distinguishes "in a submodule" from "at the top" — that
flag is the whole trick and isn't shown by default prompts. Takes effect in new shells (or
`source ~/.bashrc`).

## 2. Stamp the commit target into the message editor

A **global** hook (applies to every repo, including submodules). Every commit message buffer opens
with a comment line naming the target repo — stripped from the final message, so it's pure signal.

```bash
git config --global core.hooksPath ~/.git-hooks
mkdir -p ~/.git-hooks
cat > ~/.git-hooks/prepare-commit-msg <<'EOF'
#!/bin/sh
top=$(git rev-parse --show-toplevel 2>/dev/null)
super=$(git rev-parse --show-superproject-working-tree 2>/dev/null)
br=$(git symbolic-ref --short HEAD 2>/dev/null || echo DETACHED)
label=$(basename "$top")
[ -n "$super" ] && label="$label (submodule of $(basename "$super"))"
printf '\n# >>> committing to: %s [%s] <<<\n' "$label" "$br" >> "$1"
local_hook="$(git rev-parse --git-dir 2>/dev/null)/hooks/prepare-commit-msg"
[ -x "$local_hook" ] && exec "$local_hook" "$@"
exit 0
EOF
chmod +x ~/.git-hooks/prepare-commit-msg
```

You'll see, e.g.:

```
# >>> committing to: gyopart (submodule of workspace) [main] <<<
```

**Caveat:** `core.hooksPath` makes git look in `~/.git-hooks` for *all* hooks in *every* repo,
shadowing per-repo `.git/hooks`. The hook above chains to a local `prepare-commit-msg` if present,
but *other* hook types (e.g. `pre-commit`) in some repo would be bypassed. If you ever add per-repo
hooks and they stop firing, that's why.

## 2a. Install the git guards (required — one command)

The pre-commit guard (CONVENTIONS.md §9) blocks commits on a detached HEAD, commits made while
behind upstream, and staged secrets. It reaches every repo through `core.hooksPath`, which lives in
`.git/config` and therefore **cannot be committed** — so it has to be installed once per clone:

```bash
./meta/bin/install-git-guards.sh          # --dry-run to preview
```

Idempotent; re-run it after adding a submodule.

**This interacts with §2 above, and the interaction is not optional to understand.** Git consults
exactly one hooks directory. Setting a *local* `core.hooksPath` (what the installer does) shadows
the *global* `~/.git-hooks` from §2 completely — which silently disabled the commit-target stamp in
all 87 repos the first time this was installed. The fix is already in place:
`meta/bin/githooks/prepare-commit-msg` is a shim that chains to whatever global hook is configured,
so both fire. If you add another *global* hook type later, add a matching shim here or it will not
run inside the workspace.

The same caveat §2 raises applies in reverse, and is worth restating: if a hook stops firing
somewhere, `git config --get core.hooksPath` in that repo is the first thing to check.

## 2b. Install the skill symlinks

```bash
./meta/SKILLS/install_skill_symlinks.sh   # --dry-run to preview
```

Links every top-level folder in `meta/SKILLS` containing a `SKILL.md` into `~/.claude/skills` and
`~/.agents/skills`. Retired skills live in `meta/SKILLS/archive/` and are deliberately not
discovered.

## What does *not* need per-machine setup

The session-start git sync (`meta/bin/wsgit-status`, CONVENTIONS.md §9) is wired through
`.claude/settings.json`, which **is** committed, and neither the hook command nor the script
hardcodes a path — so it works in any clone at any path with no setup at all. It fetches the
superrepo and all submodules in parallel and fast-forwards whatever is safe before the first prompt.

## 3. When it must be unambiguous: `git -C`

For scripts (or anything you don't want depending on `cwd`), target the repo explicitly:

```bash
git -C ~/documents/workspace commit ...                    # the superrepo
git -C ~/documents/workspace/automotive/gyopart commit ... # a submodule
```

Handy aliases: `alias gws='git -C ~/documents/workspace'`.

## Optional: surface submodule state in the superrepo

Display-only, non-enforcing (deliberately *not* including `push.recurseSubmodules=check`, which
would block pushes on any uncommitted/unpushed submodule):

```bash
git config --global status.submoduleSummary true   # `git status` shows what changed inside submodules
git config --global diff.submodule log             # `git diff` shows submodule commit logs, not bare SHAs
git config --global submodule.recurse true         # pull/checkout/switch recurse by default
```

---

## Undo

```bash
git config --global --unset core.hooksPath          # disable the global hook
# delete the "submodule-aware git context" block from ~/.bashrc
```

## The structural side

Tooling mitigates the confusion; **reducing submodule boundaries removes it.** Consolidating
cohesive systems into monorepos (`gyopart`, `scrape-stack`, `meta/SKILLS`) and only making
something a submodule when it genuinely warrants independent life ([`CONVENTIONS.md`](./CONVENTIONS.md)
§1a) keeps the number of seams — and the number of places to be standing in the wrong one — low.
