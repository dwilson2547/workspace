---
title: argocd: new helm-based app repos need a repo-<name> repository secret
date: 2026-10-14
tags: argocd,k8s,github
---

A new helm-based Application pointing at git@github.com:dwilson2547/<repo>.git fails with ComparisonError 'failed to list refs: error creating SSH agent: SSH_AUTH_SOCK not-specified' until ArgoCD has repo credentials. The cluster pattern: one Secret per repo in the argocd namespace, named repo-<name>, labeled argocd.argoproj.io/secret-type=repository, with fields sshPrivateKey (the shared dwilson2547 account key), type=git, url=<repo ssh url>. Existing examples: repo-scrape-stack, repo-cluster-config, repo-web-workflows. The key can be copied from an existing repo secret and verified with GIT_SSH_COMMAND ssh -i <key> git ls-remote <url>.
