---
title: Homepage dashboard — gethomepage.dev on home.cluster.local
date: 2026-05-31
tags: homepage, cluster_config, infrastructure, dashboard
---

Deployed at home.cluster.local via homepage/ in cluster_config. ServiceAccount + ClusterRole gives read access to namespaces, pods, nodes, ingresses, and ingressroutes for the Kubernetes widget. ConfigMap holds all config (services.yaml, widgets.yaml, settings.yaml, etc.) — edit in cluster_config and ArgoCD rolls it automatically, no image rebuild. Services grouped by: Gyopart, Gyopart Dev, Scrape Stack, Scrape Stack Dev, AI Services, Cluster, Infrastructure. Infrastructure IPs (router/TrueNAS/Unraid/HPC) show ping status. Dev registry links (Docker Hub, PyPI, GitHub repos) in bookmarks sidebar. HOMEPAGE_ALLOWED_HOSTS must include the ingress hostname alongside $(MY_POD_IP):3000 or the health check blocks the pod.
