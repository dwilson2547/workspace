---
title: ArgoCD plain-HTTP ingress via Traefik nginx emulator
date: 2026-05-31
tags: argocd, k8s, ingress, traefik, coredns
---

ArgoCD exposed at argocd.local via Traefik (ingressClassName: nginx). Requires server.insecure=true in argocd-cmd-params-cm configmap so argocd-server does not terminate TLS. Ingress backend uses port name=http (port 80). No SSL annotations needed. DNS zone db.argocd.local in CoreDNS points apex @ A record to 192.168.0.60. Manifests at cluster/argocd/ingress.yaml. Apply ConfigMap first then restart argocd-server deployment to pick up insecure flag.
