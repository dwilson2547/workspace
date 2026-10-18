---
tier: experiment
domains: [infra]
---

# portable_cluster

Design for a repeatable "data node" cluster blueprint: each node contributes local
storage, and every service's data is **sharded at the application layer** — the
datastore's own clustering (partitions, ranges, slots) owns replication and
rebalancing. No storage-layer replication (no Longhorn — it was tried and burned
idle CPU per volume). The nodes are disposable cattle: boot, self-register, join,
hold a slice of the data.

## What we're building

```tree
hot tier        local PVs per node (local-path / node disk), sharded by the app
                Kafka partitions | CockroachDB ranges | Redis Cluster slots
shared tier      nfs-dataset (TrueNAS ssd_pool): backups, uploads, cold blobs
bucket tier      object storage for large/immutable data
membership       self-registration on boot, health-checked deregistration
                (in k8s: StatefulSet + operator; Consul optional, see below)
```

Candidate services, in build order:

1. **Kafka** (Strimzi, KRaft) — designed for exactly this; batched sequential IO
   over the network; ISR replication handles node churn.
2. **CockroachDB** — the Postgres-shaped version of the same idea: nodes join at
   will, ranges rebalance, survives node loss with quorum.
3. **Redis Cluster** — slots across nodes, elastic pool semantics (also the
   Consul learning exercise if we do that sandbox).

Quorum floor: three nodes minimum for any of these (2f+1). Backups are
app-consistent (WAL dump / Kafka mirror / CRDB backup) to the NFS or bucket tier
— there is no storage-layer replica to fall back on.

## Node profile (target hardware)

- Old office PCs: 32–64 GB RAM, decent-not-extreme desktop CPU, 10 GbE.
- One 2 TB NVMe per node (OS + local-path data on the same drive is fine for
  this design — the hot tier only needs a directory per node). Single-M.2-slot
  machines are acceptable; two slots is a bonus, not a requirement.
- Uniformity matters: same template/layout per node so shard performance is even
  and nodes are interchangeable.

## Measured baseline (2026-10-18)

`infra/vmk8-cluster-config/docs/storage-tier-benchmark.md` — the important
negative result: on the Epyc/ZFS/SATA vDisk stack, local did NOT beat NFS
(guest O_DIRECT hits ZFS sync-write semantics; reads served from host ARC).
Implication: **the payoff comes from bare-metal NVMe with ext4/XFS**, not from
the hypervisor stack. Functionality and topology can be proven on VMs;
performance must be measured on the target hardware.

## Experiment paths

| Path | Setup | Pros | Cons |
|---|---|---|---|
| A. vmk8 (VM cluster) | 5 uniform VMs, cloned from one template; `local-path` SC already deployed; GitOps/ArgoCD live | uniform nodes; disposable; everything staged; fastest to iterate | ZFS/SATA vDisk ceiling — fine for topology, useless for perf claims |
| B. prod physical cluster | 3 nodes, small local PVCs | real disks incl. (probably) one NVMe | ⬜ unverified: disk types ("one NVMe, two SATA SSD" — needs `lsblk` confirmation); heterogeneous nodes = uneven shard speed; it's the prod cluster — blast radius |
| C. future hardware | office-PC nodes as specced above | the real design target | requires the hardware |

Recommendation: **run A first** (topology: Strimzi Kafka on local-path PVs,
scale 1→3, kill a node, watch ISR rebalance) — it de-risks everything and the
cluster is disposable. Use B only for a perf spot-check, with small PVCs and
nothing prod-critical scheduled to the data nodes; treat C as the real
measurement target once nodes exist.

## Consul's place (decision record)

In a single k8s cluster the built-in registry (etcd/Endpoints/CoreDNS) already
answers "where is the thing" — Consul is redundant. It earns a role only if the
blueprint goes mixed-estate (k8s clusters + VMs + bare metal like a future GPU
box sharing one live catalog) or as a deliberate practice environment for work.
Default for this project: app-native membership (operators/gossip), no Consul.

## Verification checklist

- [ ] `lsblk` the three prod nodes — confirm NVMe vs SATA assumption (Path B)
- [ ] Strimzi Kafka on vmk8 local-path: deploy, scale 1→3, partition rebalance
- [ ] Node-kill test on vmk8: ISR/under-replicated recovery timing
- [ ] CockroachDB single-node first, then 3-node on vmk8
- [ ] Perf rerun on Path B/C hardware; compare against the NFS baseline
