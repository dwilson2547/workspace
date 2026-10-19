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
bucket tier      Garage (S3-compatible): every node holds part of every object
                (3x replication or Reed-Solomon erasure coding), local disks
membership       self-registration on boot, health-checked deregistration
                (in k8s: StatefulSet + operator; Consul optional, see below)
```

Candidate services, in build order:

1. **Garage** (S3-compatible object storage) — the easiest entry point: single
   Rust binary, tiny idle footprint, native multi-node layout where each node
   stores a slice of every object (3x replication or erasure codes). Speaks S3,
   so existing bucket consumers can target it later. Also natively geo-aware
   (zone-aware layouts) — the one service here that's designed for *multi-site*
   from day one, matching the "portable" ambition.
2. **Kafka** (Strimzi, KRaft) — designed for exactly this; batched sequential IO
   over the network; ISR replication handles node churn.
3. **CockroachDB** — the Postgres-shaped version of the same idea: nodes join at
   will, ranges rebalance, survives node loss with quorum.
4. **Redis Cluster** — slots across nodes, elastic pool semantics (also the
   Consul learning exercise if we do that sandbox).

Quorum floor: three nodes minimum for any of these (2f+1; Garage's 3x-replication
layout needs three, erasure coding can trade width for tolerance). Backups are
app-consistent (WAL dump / Kafka mirror / CRDB backup) to the NFS or bucket tier
— there is no storage-layer replica to fall back on. Garage stores its metadata
and data on local-path PVCs like the others.

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

Two layers, decided separately:

- **Datastore membership** stays app-native (operators/gossip/ring) — Kafka,
  CRDB, Redis Cluster and Garage each own their own clustering; nothing is
  layered on top of that. This is not a preference, it's structural: their
  failure detection (Kafka session timeouts to the KRaft controller, CRDB's
  Raft heartbeats, Redis gossip + `cluster-node-timeout`, Garage's ring) is
  internal consensus — the correctness of leader election/ISR/range leases
  depends on the participants themselves detecting loss, so an external
  registry can never sit in that path even if you wired one up. Consul's health
  signal is not an input to any availability decision; it duplicates what
  these systems already do, in about the same seconds-scale time, wired to
  nothing. New-node bootstrap is likewise native: CRDB `--join`, Redis
  `CLUSTER MEET`, Strimzi-managed broker identity, Garage layout.
  (Where an external registry WOULD be necessary: nodes without an
  orchestrator — plain VMs or bare metal. If the office-PC nodes end up not
  running k8s, this decision flips and Consul becomes the standard answer.)
- **Service registration/discovery**, if and when a registration layer is
  needed at all (cross-cluster consumers, mixed estate with VMs/bare metal
  like a future GPU box, non-k8s services): **Consul is the preferred tool.**
  Same software as work — deliberate practice value, plus the one genuinely
  idiomatic use case (one live catalog spanning k8s and non-k8s).

Inside a single k8s cluster the built-in registry (etcd/Endpoints/CoreDNS)
already answers "where is the thing" — no Consul needed there.

## Verification checklist

- [ ] `lsblk` the three prod nodes — confirm NVMe vs SATA assumption (Path B)
- [x] Garage on vmk8 local-path: deployed 3-node directly (not 1→3), 256
      partitions 3x replicated, S3 write/read verified, node-kill during read
      verified — see `infra/vmk8-cluster-config/docs/garage-experiment-notes.md`
- [x] Strimzi Kafka on vmk8 local-path: deployed (Strimzi 1.3.0, Kafka 4.3.1
      KRaft combined pool), 6-partition topic spread across all 3 brokers,
      produce/consume verified, broker-kill during production verified with
      120/120 messages intact — see
      `infra/vmk8-cluster-config/docs/kafka-experiment-notes.md`
- [ ] Node-kill test on vmk8: ISR/under-replicated recovery timing
- [x] CockroachDB 3-node on vmk8 (deployed directly at 3 nodes): table range
      replicated on {1,2,3}, INSERTs continued during a node kill (raft
      majority), 120/120 rows intact — see
      `infra/vmk8-cluster-config/docs/cockroachdb-experiment-notes.md`
      (note: chart init Job is a helm hook that deadlocks under ArgoCD;
      manual `cockroach init` required on fresh deploys)
- [ ] Perf rerun on Path B/C hardware; compare against the NFS baseline
