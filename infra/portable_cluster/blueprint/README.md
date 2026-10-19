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
| `argocd/strimzi.yaml` | Strimzi operator 1.3.0 (Kafka CRD v1, node-pool era) |
| `argocd/kafka.yaml` + `kafka/` | `lab` Kafka cluster: KRaft combined pool of 3, Kafka 4.3.1, local-path PVs, topic as code (note: app needs `directory.recurse: true` for subdirs — already set) |
| `argocd/cockroachdb.yaml` + `cockroachdb/values.yaml` | CockroachDB 25.4.4, 3 replicas on local-path, insecure dev mode |
| `argocd/redis-operator.yaml` | OT-CONTAINER-KIT redis-operator v0.27.0 |
| `argocd/redis.yaml` + `redis/values.yaml` | `RedisCluster/lab`: 3 masters + 3 replicas, quay.io/opstree/redis:v8.10.1, local-path PVs |

All four datastores verified on vmk8 under node-kill with zero data loss;
full run records and gotchas in the vmk8 repo's `docs/*-experiment-notes.md`
(garage, kafka, cockroachdb, redis — read them before deploying: each has
deployment-order traps, e.g. CRDB's init Job is a helm hook that deadlocks
under ArgoCD and needs a manual `cockroach init`).

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

# redis cluster password (redisCluster.redisSecret)
kubectl -n redis create secret generic redis-cluster-password \
  --from-literal=redis-password="$(openssl rand -hex 16)"
```

## Known gotchas — read before deploying (from the vmk8 runbook)

- `docs/garage-experiment-notes.md` in the vmk8 repo: the rpcSecret
  helm-lookup churn incident (why `existingRpcSecret` is pinned), the admin
  API token requirement, Garage v2's `/v2/<Method>` endpoints, and the
  which-webui-version-works note.
- `docs/kafka-experiment-notes.md`: Strimzi 1.x serves the Kafka CRD at v1
  only; broker topology must use KafkaNodePool CRs; ArgoCD directory apps
  need `recurse: true` for subdirs.
- `docs/cockroachdb-experiment-notes.md`: the chart's init Job is a helm
  post-install hook — under ArgoCD it deadlocks; run `cockroach init`
  manually on fresh deploys.
- `docs/redis-experiment-notes.md`: why this blueprint uses redis-operator
  instead of the bitnami chart (archived bitnamilegacy image), and the
  bitnami-run bootstrap failure modes kept as history.
- ArgoCD + helm `lookup`: any chart generating secrets that way will
  silently regenerate them — always pin to pre-existing secrets.
- local-path PVC sizes are advisory; keep retention/quotas at the app layer.
