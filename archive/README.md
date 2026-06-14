# archive/

Superseded or consolidated projects, kept for history only. Nothing here is active. See
[`../CONVENTIONS.md`](../CONVENTIONS.md) §4 (the `archive/` domain) and §8.

## Consolidated into the `gyopart` monorepo

`gyopart` (under `automotive/`) became a **true monorepo** — a single repo holding its subsystems
as plain directories rather than separate repositories. The following formerly-standalone projects
were consolidated into it and are retired:

| Former standalone repo | Now lives at |
|---|---|
| `parts-interchange` | `automotive/gyopart/parts-interchange/` |
| `junkyard-inventory-scrapers` | `automotive/gyopart/junkyard-inventory-scrapers/` |
| `junkyard-platform` | `automotive/gyopart/junkyard-platform/` |
| `gyopart-api` | `automotive/gyopart/gyopart-api/` |
| `gyopart-ui` | `automotive/gyopart/gyopart-ui/` |

Their individual repo histories were intentionally dropped during the monorepo consolidation;
`gyopart`'s history is now the system of record.

### `parts-interchange/` (this directory)

The one consolidated predecessor that still existed locally as its own git submodule
(`git@github.com:dwilson2547/parts_interchange.git`). Relocated here intact so its standalone
history stays browsable. The **live** code is in the `gyopart` monorepo above — do not develop
here.

### `junkyard-inventory-scrapers/` (this directory)

Standalone predecessor of `automotive/gyopart/junkyard-inventory-scrapers`. Verified that the
gyopart copy fully contains the standalone (no missing or differing files) before archiving.
Relocated here intact (`git@github.com:dwilson2547/junkyard_inventory_scrapers.git`). Live code is
in the `gyopart` monorepo — do not develop here.

### `parts-direct/` (this directory)

Standalone predecessor of `automotive/gyopart/parts-interchange/parts-direct`. Reconciled before
archiving: the `update-scraper/*.py` files matched gyopart's `main`, and the one file gyopart was
missing (`singlethreaded-scraper/deployments/pod-mini.yaml`) was ported into gyopart. Relocated
here intact (`git@github.com:dwilson2547/parts_direct.git`). Live code is in the `gyopart` monorepo.

> Note: `pod-mini.yaml` was ported into `gyopart` during this reconciliation. It had been hidden
> by a stale `**mini**` rule in `parts-interchange/.gitignore` (a leftover from the pre-k8s-secrets
> era — the file contains only `secretKeyRef` lookups, no hardcoded secrets). That rule was removed
> so the file tracks normally. Commit both the `.gitignore` change and `pod-mini.yaml` in the
> `gyopart` repo.

## Consolidated into the `scrape-stack` monorepo

`web-scrapers/scrape-stack` was converted from a submodule-of-submodules into a **true monorepo**:
its components are now plain directories in one repo. The following formerly-standalone repos were
absorbed and are retired (their GitHub remotes still exist but are no longer referenced):

| Former standalone repo | Now lives at |
|---|---|
| `cache_client` | `web-scrapers/scrape-stack/libs/cache_client` |
| `cache_browser` | `web-scrapers/scrape-stack/services/cache_browser` |
| `filecache` | `web-scrapers/scrape-stack/services/filecache` |
| `vidcache` | `web-scrapers/scrape-stack/services/vidcache` |
| `imgcache` | `web-scrapers/scrape-stack/services/imgcache` |
| `webcache` | `web-scrapers/scrape-stack/services/webcache` |
| `request_authorization` | `web-scrapers/scrape-stack/services/request_authorization` |
| `http-test-service` | `web-scrapers/scrape-stack/tools/http-test-service` |

`nordvpn-proxy` was **not** absorbed — it's a maintained fork with independent life, so it was kept
as a standalone tool at `tools/nordvpn-proxy` (not archived).

Components were flattened at the commits `scrape-stack` had pinned. The standalone
`bot_scraper_lib` was deleted (it lived only a few hours); the standalone `imgcache`/`webcache`/
`http-test-service`/`request_authorization` registrations at the old `web_scrapers` level were
dropped (their canonical copies are the ones above).

## Folded into the `meta/SKILLS` monorepo

These project-backed skills were small enough not to warrant separate repos, so their content now
lives as plain folders inside `meta/SKILLS`; the standalone repos are archived here intact.

| Former standalone repo | Now lives at | Archived here |
|---|---|---|
| `context-store` | `meta/SKILLS/context-store` | `archive/context-store/` |
| `ai_tool_docs` | `meta/SKILLS/ai-tool-docs` | `archive/ai-tool-docs/` |
| `ai_notes_server` | `meta/SKILLS/ai-notes-server` | `archive/ai-notes-server/` |

`ai_notes_server` is also functionally superseded by Work Manager (`workman note`); the in-repo
`ai-notes-server` skill now just redirects there.
