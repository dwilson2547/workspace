# TODO

Workspace superrepo backlog (cross-cutting / repo-management items; project-specific work goes in
each project's own TODO.md).

## Unprioritized

- [ ] **Branch-tracking submodule sync** — Configure every submodule with its tracking branch in
  `.gitmodules` (`branch = main` for most; a few use `dev`/`develop` — audit each) plus
  `update = merge`, so `git submodule update --remote` pulls latest into the local branch instead
  of detaching HEAD. Add a `git sync-subs` alias (`git submodule foreach 'git checkout <branch> &&
  git pull --ff-only'`) as the everyday sync path. Goal: submodules always sit on their branch at
  latest; superrepo gitlink drift stays ignorable background noise.
