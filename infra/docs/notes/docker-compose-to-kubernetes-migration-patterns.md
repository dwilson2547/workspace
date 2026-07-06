---
title: docker-compose to Kubernetes migration patterns
date: 2026-05-31
tags: traefik, nginx, docker-compose, ingress, migration
---

Two gotchas when moving docker-compose services to K8s. (1) nginx proxy_pass to a compose service name (e.g. 'http://api:8000/') fails in K8s — override nginx.conf via a ConfigMap mounted at /etc/nginx/conf.d/default.conf using subPath; remove the proxy block entirely if Ingress handles API routing. (2) Path prefix stripping: if Ingress routes /api/ to a FastAPI backend that mounts routes at /, use a Traefik StripPrefix middleware (traefik.io/v1alpha1, prefixes: [/api]) and annotate the Ingress with traefik.ingress.kubernetes.io/router.middlewares: <namespace>-<middleware-name>@kubernetescrd.
