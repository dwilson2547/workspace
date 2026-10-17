# TODO

Backlog imported from the retired todo store, 2026-07-06.

## Backups & resilience (gap review, 2026-10-16)

The postgres backups (cluster-config `postgres/backup.yaml`, runbook `cluster-config/docs/postgres_backup.md`) cover
the two prod postgres instances only. In order:

- [ ] **Back up the object-store buckets** — done for `nodewright`, `photo-dump-prod`/`-dev` and `part-images`
  (nightly CronJob `backup-objects` to the Unraid share, 2026-10-16/17; the latter three moved off the old MinIO
  first). Still undecided: `dxf-converter`, `race-logger` (robo-services parquet archive).
- [ ] **Back up the file volumes** — `danwiki/danwiki-uploads` (20 GiB), `web-workflows/web-workflows-db`,
  `build-sim/build-sim-data`; all `nfs-dataset` (TrueNAS). Not the scrape-stack caches (rebuildable) or iggy (pipeline data).
- [ ] **Promote scraped images from scrape-stack into `part-images`** — the parts-direct updater saves new images
  only in scrape-stack's imgcache (500 GiB `nfs-dataset` volume, not backed up). Intended split (user,
  2026-10-16): scrape-stack is a quick-recovery cache; `part-images` on AIStor is the permanent, backed-up store
  (backed up nightly once its copy from the old MinIO finishes). Needs a mechanism to move images from imgcache
  into `part-images` (e.g. a periodic job, or the updater writing both).
- [ ] **Encrypted export of the cluster's secrets** — ~110 hand-applied Secrets (authentik clients, DB credentials,
  SMTP, bucket keys, VPN) exist only in the cluster datastore; rebuilding from git would mean recreating each by hand.
  Nightly `age`-encrypted export to the backup share, plus a short rebuild runbook (what to apply in what order).
- [ ] **Route cluster alerts to email** — Alertmanager's default receiver is `null`; only the backup alerts and
  scrape-job-manager's own mail reach anyone. Pick the alerts worth mail (node down, volume filling, crashloops,
  KubeJobFailed), and silence the microk8s false positives (KubeProxyDown / KubeSchedulerDown /
  KubeControllerManagerDown: those run inside kubelite).
- [ ] **Weekly offsite copy through Syncthing** — newest dump set + bucket copies into a Syncthing folder on Unraid,
  weekly (not the dailies), which already mirrors to the friend's and parents' houses (rate-limited; a set is a few GB).
- [ ] **Protect backups from the cluster** — the cluster can delete what it writes to the backup share; a weekly
  read-only snapshot on the Unraid side would survive a bad script or pod.
- [ ] **TimescaleDB: back up or not** — it holds only robo-services' `telemetry.track_position_samples` (Flink sink,
  ~10 MB on 2026-10-16), i.e. pipeline output, which is why it was likely left out. Find where the parsed laps and
  tracks live (the registry's `/api/analytics/sessions/{id}/laps`) and back those up instead if they aren't already.
- [ ] **Less by-hand release work** — tests run only when someone runs them, migrations are applied by hand, and
  dev→prod promotion is by cherry-pick while dev carries unreleased work. A free CI running tests on push
  (`infra/desktop-jenkins` exists) and a promote checklist.

## Medium

- [ ] **Plan migration from legacy MinIO to AiStor** — Evaluate moving existing data from the legacy MinIO instance to AiStor so we avoid re-ingesting roughly 6 million photos.
- [ ] **Install Proxmox and ZFS on the EPYC box** — Install Proxmox on the EPYC machine and bring up the ZFS filesystem so the box becomes a stronger base for HPC-related work.
- [ ] **Fix Grafana dashboard sidecar reload auth** — The monitoring Grafana sidecar writes dashboard files into /tmp/dashboards but POSTs to /api/admin/provisioning/dashboards/reload return 401 Unauthorized, so newly synced dashboards may not appear immediately. Investigate the admin secret/runtime password mismatch and restore reliable sidecar-triggered reloads.

## Low

- [ ] **Add widgets to the homepage deployment** — Experiment with wiring widgets into the homepage deployment to improve the look and usefulness of the landing page.
- [ ] **Evaluate running an OSM instance on the cluster** — Look into spinning up an OSM instance on the cluster and determine the operational footprint and usefulness.
