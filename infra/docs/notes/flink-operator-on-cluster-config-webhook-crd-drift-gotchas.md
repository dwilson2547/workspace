---
title: Flink operator on cluster_config: webhook + CRD drift gotchas
date: 2026-05-31
tags: flink, argocd, cluster_config, operator
---

Apache Flink Kubernetes Operator chart 1.14.0 installs cleanly in cluster_config via argocd/flink-operator.yaml with repo values in flink-operator/values.yaml. This cluster does not have cert-manager yet, so webhook.create must stay false or ArgoCD sync fails on cert-manager Issuer/Certificate resources; the operator still runs fine without the webhook. After install, ArgoCD may still show the Flink CRDs OutOfSync because the API server defaults CRD fields like spec.conversion, spec.names.listKind, and zero-valued additionalPrinterColumns.priority differently from the chart. Ignore those CRD fields in the Application and enable RespectIgnoreDifferences=true to keep the app Synced/Healthy. For job-level patterns, pitfalls, and rapid iteration tips (FlinkDeployment patching, SLF4J format strings, keyed streams) see playbooks: robo-services/flink-patterns-and-pitfalls
