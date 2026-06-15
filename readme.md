# Workspace repo to pull all my code in one place

> **Structure & conventions:** see [`CONVENTIONS.md`](./CONVENTIONS.md) for the closed domain
> taxonomy, placement rules, and knowledge layout. Agents follow [`CLAUDE.md`](./CLAUDE.md) /
> [`AGENTS.md`](./AGENTS.md) and the `workspace-conventions` skill.
>
> **Working here:** [`SUBMODULES.md`](./SUBMODULES.md) — per-machine setup (prompt + commit-target
> hook) to avoid committing to the wrong repo in this submodule-heavy layout.

Add new submodule: 

`git submodule add https://github.com/username/repo-name.git path/to/submodule`

# Initialize and update all submodules
git submodule init
git submodule update

# Or do both in one command
git submodule update --init --recursive

# Clone a repository with all its submodules
git clone --recurse-submodules https://github.com/username/main-repo.git

# Update a specific submodule to latest commit
cd path/to/submodule
git pull origin main
cd back/to/main/project
git add path/to/submodule
git commit -m "Update submodule"

# Remove a submodule
git submodule deinit path/to/submodule
git rm path/to/submodule
rm -rf .git/modules/path/to/submodule