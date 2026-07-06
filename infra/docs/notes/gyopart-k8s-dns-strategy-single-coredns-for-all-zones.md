---
title: Gyopart k8s DNS strategy: single CoreDNS for all zones
date: 2026-05-31
tags: dns, coredns, cluster_config, infrastructure
---

All private DNS is served from the single prod CoreDNS pod in the dns namespace at 192.168.0.61. Never deploy additional DNS pods. Add new zones by updating cluster_config/dns/dns.yaml: add a zone block to the Corefile and a db.* zone file entry. The CoreDNS Deployment is now annotated with configmap.reloader.stakater.com/reload: coredns-local-config so Stakater Reloader can trigger a rollout automatically when that ConfigMap changes, avoiding the previous manual rollout restart step as long as the reloader app is installed and healthy. Wildcard A records point to Traefik at .60; explicit records override for gRPC LoadBalancers. Zones include scrapestack.local, scrapestack-dev.local, monitoring.local, argocd.local, ai-services.local, cluster.local, robo-services.local, and pub-sub.local.
