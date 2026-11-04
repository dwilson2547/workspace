---
title: Postgres backup version-matching gotcha
date: 2026-10-15
tags: postgres,backup,nfs,k8s
---

Nightly postgres backups to the Unraid NAS (192.168.0.15) ship in infra/cluster-config postgres/backup.yaml: per-instance CronJobs, pg_dump -Fc + globals, 7d/4w retention, weekly restore test. Gotcha: pg_restore v17 emits SET transaction_timeout which a PG16 server rejects - each instance's CronJob must use a client image matching the server major version. NFS export squashes to uid 99/gid 100, pods run as 99:100. See: infra/cluster-config/docs/issues/2026_10_15_pgvector_restore_transaction_timeout.md
