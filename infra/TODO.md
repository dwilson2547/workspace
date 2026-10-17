# TODO

Backlog imported from the retired todo store, 2026-07-06.

## Backups & resilience (gap review, 2026-10-16)

The postgres backups (cluster-config `postgres/backup.yaml`, runbook `cluster-config/docs/postgres_backup.md`) cover
the two prod postgres instances only. In order:

- [ ] **Back up the object-store buckets** — done for `nodewright`, `photo-dump-prod`/`-dev` and `part-images`
  (nightly CronJob `backup-objects` to the Unraid share, 2026-10-16/17; the latter three moved off the old MinIO
  first). Still undecided: `dxf-converter`, `race-logger` (robo-services parquet archive).
- [x] **Back up the file volumes** — CronJob `backup-volumes` (cluster-config `postgres/volume-backup.yaml`,
  2026-10-17): web-workflows and build-sim SQLite DBs via the online backup API, danwiki uploads mirrored; runbook
  section "File volumes" in `cluster-config/docs/postgres_backup.md`. Not the scrape-stack caches or iggy.
- [ ] **Promote scraped images from scrape-stack into `part-images`** — the parts-direct updater saves new images
  only in scrape-stack's imgcache (500 GiB `nfs-dataset` volume, not backed up). Intended split (user,
  2026-10-16): scrape-stack is a quick-recovery cache; `part-images` on AIStor is the permanent, backed-up store
  (backed up nightly once its copy from the old MinIO finishes). Needs a mechanism to move images from imgcache
  into `part-images` (e.g. a periodic job, or the updater writing both).
- [x] **Encrypted export of the cluster's secrets** — nightly CronJob `backup-secrets` (cluster-config
  `secrets-backup/`, 2026-10-17): all Secrets, `age`-encrypted to the user's public key, 28 days on the backup
  share; restore and rebuild runbook in `cluster-config/docs/secrets_backup.md`. First run: 114 secrets.
- [x] **Route cluster alerts to email** — AlertmanagerConfig `cluster-alerts` is the root config (2026-10-17): all
  criticals plus a short warning list mailed; KubeJobFailed without scrape-job-manager's retried Jobs; microk8s
  kube-proxy/scheduler/controller-manager/etcd monitoring off. Runbook `cluster-config/docs/alerting.md`.
- [x] **Weekly offsite copy** — CronJob `offsite-backup` (cluster-config `offsite-backup/`, 2026-10-17): restic
  snapshot of the whole backup share to MEGA S4 (Montreal), Sunday 07:00 ET, 4 weekly + 6 monthly kept, monthly
  5% read-back check; runbook `cluster-config/docs/offsite_backup.md`. First run 6.3 GiB; restore of a secrets
  export and a dump tested. part-images (~135 GiB) joins on the first run after its nightly copy lands.
- [ ] **Syncthing mirror of the backup share** — the user still plans to mirror the share to the friend's and
  parents' houses via Syncthing on Unraid (set up on the Unraid side).
- [x] **Protect backups from the cluster** — decided 2026-10-17: no Unraid-side snapshots (the user won't have
  agents running commands on primary storage, and Unraid's permissions are limited). Accepted risk: the cluster can
  delete what it writes to the share. Mitigation: MEGA restic snapshots (weekly, 4 weekly + 6 monthly) and periodic
  checks that the share isn't shrinking.
- [x] **TimescaleDB / race-logger data** — decided 2026-10-17: TimescaleDB (laps are computed from its samples),
  iggy and the `race-logger` bucket stay out while the data is synthetic; revisit when the race logger holds real
  data. Kept: registry tracks (`robo_registry.tracks` on postgres-dev) via CronJob `postgres-backup-tracks`.
  Found then: iggy writes to `/app/local_data` (container filesystem), not its `iggy-data` volume at `/local_data`;
  a pod restart loses the stream data. Fix the mount when the pipeline matters.
- [ ] **Less by-hand release work** — tests run only when someone runs them, migrations are applied by hand, and
  dev→prod promotion is by cherry-pick while dev carries unreleased work. A free CI running tests on push
  (`infra/desktop-jenkins` exists) and a promote checklist.

## Medium

- [ ] **OTel instrumentation + log ingestion** — log ingestion started 2026-10-17: DaemonSet `otel-agent` ships
  the scraper fleet's `scraper` container logs to Loki over OTLP (90-day retention; runbook
  `cluster-config/docs/logging.md`). Still to do: other namespaces worth collecting, and OTel traces/metrics in the
  apps (otel-collector + Tempo already deployed).
- [ ] **Plan migration from legacy MinIO to AiStor** — Evaluate moving existing data from the legacy MinIO instance to AiStor so we avoid re-ingesting roughly 6 million photos.
- [ ] **Install Proxmox and ZFS on the EPYC box** — Install Proxmox on the EPYC machine and bring up the ZFS filesystem so the box becomes a stronger base for HPC-related work.
- [ ] **Fix Grafana dashboard sidecar reload auth** — The monitoring Grafana sidecar writes dashboard files into /tmp/dashboards but POSTs to /api/admin/provisioning/dashboards/reload return 401 Unauthorized, so newly synced dashboards may not appear immediately. Investigate the admin secret/runtime password mismatch and restore reliable sidecar-triggered reloads.

## Low

- [ ] **Add widgets to the homepage deployment** — Experiment with wiring widgets into the homepage deployment to improve the look and usefulness of the landing page.
- [ ] **Evaluate running an OSM instance on the cluster** — Look into spinning up an OSM instance on the cluster and determine the operational footprint and usefulness.
