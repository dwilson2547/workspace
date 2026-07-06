# TODO

Backlog imported from the retired todo store, 2026-07-06.

## Medium

- [ ] **Plan migration from legacy MinIO to AiStor** — Evaluate moving existing data from the legacy MinIO instance to AiStor so we avoid re-ingesting roughly 6 million photos.
- [ ] **Install Proxmox and ZFS on the EPYC box** — Install Proxmox on the EPYC machine and bring up the ZFS filesystem so the box becomes a stronger base for HPC-related work.
- [ ] **Fix Grafana dashboard sidecar reload auth** — The monitoring Grafana sidecar writes dashboard files into /tmp/dashboards but POSTs to /api/admin/provisioning/dashboards/reload return 401 Unauthorized, so newly synced dashboards may not appear immediately. Investigate the admin secret/runtime password mismatch and restore reliable sidecar-triggered reloads.

## Low

- [ ] **Add widgets to the homepage deployment** — Experiment with wiring widgets into the homepage deployment to improve the look and usefulness of the landing page.
- [ ] **Evaluate running an OSM instance on the cluster** — Look into spinning up an OSM instance on the cluster and determine the operational footprint and usefulness.
