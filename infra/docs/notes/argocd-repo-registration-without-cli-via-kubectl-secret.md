---
title: ArgoCD repo registration without CLI via kubectl secret
date: 2026-05-31
tags: argocd, git, ssh, infrastructure
---

Register a private git repo with ArgoCD by creating a Secret with label argocd.argoproj.io/secret-type=repository in the argocd namespace. Fields: type=git, url=<repo-url>, sshPrivateKey=<key-contents>. Use: kubectl create secret generic repo-<name> -n argocd --from-literal=type=git --from-literal=url=<url> --from-file=sshPrivateKey=~/.ssh/id_rsa --dry-run=client -o yaml | kubectl label --local -f - argocd.argoproj.io/secret-type=repository -o yaml | kubectl apply -f -. Useful when argocd CLI is not installed.
