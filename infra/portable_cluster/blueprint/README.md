# blueprint — working service configs for a distributed cluster

Snapshot of the proven, ArgoCD-managed configuration running on the vmk8 dev
cluster (source of truth: `infra/vmk8-cluster-config` →
github.com/dwilson2547/vmk8_cluster_config). This folder is the **starting
point to build a new distributed cluster from**: the same services, wired the
same way, with the site-specific values called out below.

This is a template, not a live repo: the vmk8 repo stays authoritative for
the running cluster; when a config proves out there, the updated version gets
copied back here. End goal: distill these into a single Helm chart that stands
the whole stack up.

## Contents

| Path | What it deploys |
|---|---|
| `argocd/apps.yaml` | app-of-apps root (the only manifest applied by hand) |
| `argocd/metallb.yaml` + `metallb/` | MetalLB v0.15.2, LAN pool, L2 advertisement |
| `argocd/traefik.yaml` + `traefik/values.yaml` | Traefik 37.4.0 ingress, LoadBalancer pinned |
| `argocd/local-path.yaml` | local-path-provisioner v0.0.37 — the hot local tier |
| `argocd/nfs-csi.yaml` + `argocd/nfs-dataset.yaml` + `storage/` | CSI NFS driver v4.13.2 + nfs-dataset StorageClass (shared tier; omit on clusters without an NFS server) |
| `argocd/garage.yaml` + `garage/values.yaml` | Garage v2.4.1 S3 storage, 3x replication on local-path |
| `argocd/garage-webui.yaml` + `garage-webui/webui.yaml` | admin UI for Garage, LAN-only ingress |

## Site values to change per deployment

- `argocd/*.yaml` repoURLs: point at the new cluster's config repo (or inline
  the manifests until one exists).
- `metallb/pool.yaml`: the LAN address pool — must be disjoint from node IPs,
  any other cluster's pool, and the DHCP range.
- `traefik/values.yaml`: the pinned LoadBalancer IP.
- `storage/nfs-dataset.yaml` + `argocd/nfs-csi.yaml`: NFS server + share
  (or drop both if the cluster is local-storage-only).
- `garage-webui/webui.yaml`: ingress hostname; DNS zone must cover it.

## Hand-applied secrets (never in git — apply per cluster, once)

```bash
# garage rpc secret (referenced via existingRpcSecret)
kubectl -n garage create secret generic garage-rpc-secret \
  --from-literal=rpcSecret="$(openssl rand -hex 32)"

# garage admin API token (GARAGE_ADMIN_TOKEN / API_ADMIN_KEY)
kubectl -n garage create secret generic garage-admin-token \
  --from-literal=adminToken="$(openssl rand -hex 32)"
```

## Known gotchas — read before deploying (from the vmk8 runbook)

- `docs/garage-experiment-notes.md` in the vmk8 repo: the rpcSecret
  helm-lookup churn incident (why `existingRpcSecret` is pinned), the admin
  API token requirement, Garage v2's `/v2/<Method>` endpoints, and the
  which-webui-version-works note.
- ArgoCD + helm `lookup`: any chart generating secrets that way will silently
  regenerate them — always pin to pre-existing secrets.
- local-path PVC sizes are advisory; keep retention/quotas at the app layer.
