---
title: Reloader namespace scope gotcha
date: 2026-05-31
tags: argocd, reloader, dns, configmap
---

Stakater Reloader was deployed in the reloader namespace with watchGlobally=false, so it did not react to ConfigMap changes in dns or other namespaces even though workloads had reloader annotations. Fix was to set cluster_config/argocd/reloader.yaml to watchGlobally=true, push cluster_config/main, and manually re-apply the ArgoCD Application manifest so the reloader deployment rolled with cluster-wide watch enabled.
