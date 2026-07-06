---
title: cluster.local — central DNS zone for cluster services
date: 2026-05-31
tags: dns, coredns, cluster_config, infrastructure
---

cluster.local is the canonical zone for cluster-wide services not tied to a specific stack. Currently: home.cluster.local → Homepage dashboard. Wildcard A record (* IN A 192.168.0.60) so any new subdomain auto-resolves to Traefik without a DNS update. Add new zone entries in cluster_config/dns/dns.yaml Corefile + data section. The coredns-local Deployment is now annotated with configmap.reloader.stakater.com/reload: coredns-local-config so Stakater Reloader should roll CoreDNS automatically when ArgoCD applies DNS ConfigMap changes; only use a manual rollout restart if reloader is unavailable or does not trigger. Other zones follow stack ownership: scrapestack.local, scrapestack-dev.local, gyopart.local, gyopart-dev.local, ai-services.local, argocd.local, monitoring.local, robo-services.local, and pub-sub.local.
