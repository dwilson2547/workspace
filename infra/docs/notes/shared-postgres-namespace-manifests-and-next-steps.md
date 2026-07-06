---
title: Shared Postgres namespace — manifests and next steps
date: 2026-05-31
tags: postgres, k8s, cluster, infrastructure
---

Created cluster/postgres/ with namespace.yaml, postgres.yaml (Bitnami postgresql:17.6.0, 100Gi nfs-crucial PVC, StatefulSet), and example_secret.yml. Connection string for all services: postgresql://user:pass@postgres-postgresql.postgres.svc.cluster.local:5432/dbname. PVC survives StatefulSet deletion by design; expandable online via kubectl patch pvc. To deploy: cp example_secret.yml secret.yml, fill in password, kubectl apply -f namespace.yaml -f secret.yml -f postgres.yaml. Next: when scrape-stack is redeployed via helm, remove postgres.yaml template from chart and update all POSTGRES_* env vars to point at new hostname. Intended consumers: gyopart-api, inventory_api, admin_api, parts-interchange, and future motorcycle system (moto schema).
