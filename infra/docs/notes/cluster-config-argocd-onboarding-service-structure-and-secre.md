---
title: cluster_config ArgoCD onboarding — service structure and secret pattern
date: 2026-05-31
tags: argocd, cluster_config, infrastructure, gitops
---

cluster_config repo (git@github.com:dwilson2547/cluster_config.git) manages homelab infrastructure via ArgoCD. Services include searxng, vpn, dns (includes ddclient), monitoring, postgres, ai-services (AI Notes, Context Store, AI Tool Docs), gyopart, gyopart-dev, and homepage; secrets remain pre-provisioned and uncommitted via example-secrets templates.
