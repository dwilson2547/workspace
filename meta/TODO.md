# TODO

Backlog imported from the retired todo store, 2026-07-06.

## Medium

- [ ] **Initialize todo-store as a git repo and publish it** — Create a standalone git repository for todo-store, preserve the current work, and publish it to the appropriate remote. *(note: todo store is being retired in favor of these TODO.md files — this item is likely obsolete)*
- [ ] **Expand the OTEL monitoring skill for Loki and Tempo** — Update the OTEL monitoring skill so it also covers Loki and Tempo guidance in addition to the metrics collector path.
- [ ] **Build a skill for Playwright UI testing** — Develop a reusable skill for Playwright-based UI testing so agents can follow hard parameters and write tests that validate consistently between runs. *(note: a `playwright-testing` skill now exists — verify coverage and check off)*
- [ ] **Build a trunk-flow CI skill** — Create a reusable skill for your particular trunk-flow CI workflow, using the scrape-stack repositories as the reference model for pipeline structure and conventions. *(note: a `trunk-flow-ci` skill now exists — verify coverage and check off)*
- [ ] **Standardize AI extension service UIs with dark mode by default** — Standardize the UIs across the AI extension/skill-backed services so they share a more consistent look and interaction pattern, and switch the default theme to dark mode.

## Low

- [ ] **Doc quality signals for doc-indexer (review queue, not auto-delete)** — Keep detailed docs (issue
  write-ups age well: dated, describe a moment) but stop stale or out-of-scope ones getting in the way. Start cheap
  and objective: (1) flag docs whose referenced files/symbols/images no longer exist, and notes untouched while the
  code they describe changed; (2) log what doc-indexer returns per query + project and whether the agent then
  opened/cited it ("returned often, never used" = review candidate). Only then consider explicit agent votes, with a
  reason: helpful / stale / wrong / wrong-scope (a scoping problem, not an archive reason) / duplicate. Votes live
  in a sidecar log under meta/ keyed by doc path, not in the docs (no commit churn across submodules). Flagged docs
  go to a manual review queue; archiving moves them to an archive/ folder doc-indexer skips. Context: the retired
  AI-notes system failed because agents had to read unscoped notes before every task and mixed up projects; the
  domain hierarchy + doc-indexer fixed the scoping (user, 2026-10-16).
- [ ] **Clean up junk projects in the workspace directory** — Review the workspace directory and remove or archive throwaway projects such as the multiple task-queue-apps and cronjob_manager.
