---
title: cluster_config pub-sub iggy app
date: 2026-05-31
tags: argocd, cluster_config, iggy, pub-sub
---

Added a dedicated pub-sub stack to cluster_config with pub-sub/deployment.yml, argocd/pub-sub.yaml, and example-secrets/pub-sub/secret.yml. ArgoCD app pub-sub is applied and syncing on microk8s; the initial PVC needed storageClassName nfs-dataset to bind on this cluster, and after that fix the only remaining live blocker is the missing iggy-secret in the pub-sub namespace. The stack now also exposes Iggy HTTP on iggy.pub-sub.local for browser access, runs apache/iggy-web-ui:0.3.0 behind iggy-web.pub-sub.local, enables Iggy HTTP CORS for the UI origin, adds a new pub-sub.local CoreDNS zone routed through Traefik, adds the UI to the homepage dashboard, and is scraped by Prometheus via a monitoring/ServiceMonitor that targets the iggy Service in pub-sub on the HTTP /metrics endpoint.
