# First kawasaki fleet rollout: image permissions and scrape-stack DNS

Date: 2026-10-13
Project: motorcycle parts reference system (this dir + `infra/cluster-config/motorcycles/`)
Status: resolved

## Symptom 1 — scraper container crashed on import

First fleet run (dev) failed immediately:

```
PermissionError: [Errno 13] Permission denied: '/app/motorcycle_common/__init__.py'
```

## Root cause

The image runs as `USER 10001`, but Docker `COPY` preserves the source file's
permission bits from the build context. `motorcycle_common/*.py` had been created
with mode 600 (the file-writing tool used to author them defaults to 600; the
rest of the repo's files are 644). USER 10001 could not read its own package.

## Fix

`kawasaki/Dockerfile` now runs `RUN chmod -R a+rX /app` after the `COPY` steps,
so the image is immune to whatever umask/permissions the build context has.

## Symptom 2 — first prod run failed Broken: name or service not known

```
Broken: scrape-stack cache service unreachable: [Errno -2] Name or service not known
```

## Root cause

The dev scrape-stack namespace is `scrapestack-dev` (no hyphen), but the prod
one is `scrape-stack` (hyphenated). The kawasaki prod env had copied the dev
service URLs (`webcache.scrapestack.svc.cluster.local`), which do not resolve in
prod. Always take service DNS from `kubectl -n <ns> get svc`, not from the
other environment's values.

## Notes for the next OEM scraper rollout

- Build context files must be readable (644) or the Dockerfile must chmod —
  non-root USER plus restrictive COPY modes is a silent failure that only
  appears at runtime.
- Dev and prod scrape-stack namespaces are named differently; the service URLs
  differ between the two `kawasaki.yaml` manifests on purpose.
- Manually deleting a run pod (to "stop cleanly") is recorded by the operator
  as BackoffLimitExceeded, not as a graceful stop — use a short `timeout` on the
  Scraper (SCRAPE_DEADLINE makes the scraper exit 0 at the deadline) if a short
  verification run is needed.
