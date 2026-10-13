---
title: Motorcycle parts reference system live in prod
date: 2026-10-12
tags: motorcycles,scrapers,kubernetes
source: automotive/motorcycles/RELEASES.md
---

kawasaki is the first motorcycle parts scraper under scrape-job-manager: namespaces motorcycles/motorcycles-dev, weekly motorcycle-parts pool, image dwilson2547/motorcycle-scraper-kawasaki pinned by digest. All OEM scrapers share one motorcycle_parts Postgres database through automotive/motorcycles/motorcycle_common (make + variant_key identity, imgcache content hashes, JSONB extras for OEM columns). Adding another OEM: convert to the common schema, Dockerfile with chmod after COPY, digest-pin in infra/cluster-config/motorcycles/{dev,prod}. See: automotive/motorcycles/RELEASES.md, automotive/motorcycles/docs/issues/2026_10_13_first-fleet-rollout-permissions-and-dns.md
