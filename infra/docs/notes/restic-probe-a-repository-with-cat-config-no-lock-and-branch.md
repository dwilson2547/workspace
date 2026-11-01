---
title: restic: probe a repository with cat config --no-lock and branch on exit 10
date: 2026-11-01
tags: restic,backup,gotcha
source: infra/cluster-config/docs/issues/2026_11_01_offsite_backup_check_oom_stale_lock.md
---

restic cat config takes a lock, so a lock left by a killed run makes it fail; a script that treats any failure as 'no repository' then runs init on an existing repo ('already initialized'). Use 'restic cat config --no-lock' and run init only on exit code 10 (repository does not exist, restic >= 0.17); run 'restic unlock' (clears stale locks) before anything that locks. Also: restic check --read-data-subset needed ~4.9 GiB on a ~145 GiB repo.
