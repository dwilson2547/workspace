---
title: k8s-main recurring microk8s containerd failure — CRITICAL recurring issue
date: 2026-05-31
tags: incident, microk8s, containerd, nfs, k8s-main, recurring, critical
---

RECURRING ISSUE. k8s-main silently breaks: node shows Ready=True but ALL pods stuck in ContainerCreating with no events and PodReadyToStartContainers=False. Even simple busybox pods fail. Kubelet is healthy; containerd is broken internally. Partial fixes (restart csi-nfs-node, restart calico-node) do NOT fix it. ONLY FIX: SSH to k8s-main, run 'microk8s stop && microk8s start', then 'kubectl uncordon k8s-main'. Quick diagnostic: 'timeout 5 /var/snap/microk8s/current/bin/crictl --runtime-endpoint unix:///var/snap/microk8s/common/run/containerd.sock info' — if it times out, containerd is hung. Likely triggered by NFS stale mounts after force-deleted pods. Full analysis + prevention options: context-store: cluster/issues/microk8s-main-node-runtime-failure | docs/issues/2026_05_27_microk8s_main_node_runtime_failure.md

Full write-up: infra/cluster-config/docs/issues/2026_05_27_microk8s_main_node_runtime_failure.md
