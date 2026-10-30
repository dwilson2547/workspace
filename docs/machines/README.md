# machines

Triage records and hardware facts for the machines this workspace is built on and runs on — hardware, kernel, driver and
display-stack problems. Workspace scope by the §5 admission rule: these machines underpin every
domain, so the knowledge belongs to no single one.

Dated records, one per root cause, in the `issue-documentation` format.

## HP Pavilion Gaming Laptop 15-ec2xxx

Ubuntu 24.04 LTS. Hybrid AMD Cezanne iGPU + NVIDIA GTX 1650 Mobile. **HDMI is wired to the discrete
GPU**, which makes the NVIDIA driver a hard dependency for any external display — the single most
load-bearing fact about this machine.

| Record | Root cause | Status |
|---|---|---|
| [2026_09_06 — NVIDIA modules stop tracking the kernel](2026_09_06_nvidia_module_missing_hdmi_not_detected.md) | Prebuilt module packages pinned to one kernel ABI; dGPU left driverless, HDMI port absent from `/sys/class/drm` entirely | Fixed |
| [2026_09_06 — RRTellChanged use-after-free kills the GDM greeter](2026_09_06_xorg_greeter_crash_rrtellchanged.md) | `xf86platformRemoveDevice` calls `RRTellChanged` after the GPU screen's `rrScrPriv` is freed, while still linked in `primary->secondary_list` | Root-caused, unfixed |

## Tower: Unraid backup box (192.168.0.15)

The cluster's backup target (`/mnt/user/cluster_backup`, NFS). The live data is on TrueNAS (192.168.0.10).

| | |
|---|---|
| Motherboard | **MSI PRO B760M-A WIFI DDR4** (user's word, 2026-10-18) |
| BIOS | 1J, updated 2026-10-18 (user) |
| OS | Unraid 7.3.4 (user, PHP security patch, installed 2026-10-22; upgraded from 7.3.3, which was installed 2026-10-18). Kernel `6.18.54-Unraid` verified with `uname -r` on 7.3.3; ⚠ unverified on 7.3.4 |
| NFS | `fs.leases-enable=0` (no delegations) set in `/boot/config/go`; nfsd threads raised to 64 (user, 2026-10-18) |

- **`/mnt/minio-pool`** (btrfs RAID1, 3 devices: sdi, sdk, sdl) is used only by the old MinIO container. Its
  buckets moved to AIStor on TrueNAS on 2026-10-16, and nothing is known to write to it. On 2026-10-18 the lifetime
  counters showed `corruption_errs` 24 (sdk) and 43 (sdl), with 0 read/write/flush errors. A scrub on 2026-10-19
  (459.40 GiB) found no errors, and the counters were reset with `btrfs device stats -z` (user, 2026-10-20). If they
  climb again, run memtest86+: checksum errors across several disks point to something they share (non-ECC RAM,
  controller, cabling), not one disk.

| Record | Root cause | Status |
|---|---|---|
| [2026_10_20 — Plex codec injection: miner + residential proxy](2026_10_20_plex_owner_token_transcoder_codec_injection.md) | Stolen owner token used to set `TranscoderH264Options=dump-yuv=…/Codecs/…/zz*.so`, so a transcode loaded the attacker's code | Fixed (container rebuilt, tokens revoked, port closed; port forward restored 2026-10-29) |
| [2026_10_29 — Plex Remote Access red with port open: cert chain ends at ISRG Root YR](2026_10_29_plex_remote_access_unknown_ca_root_yr.md) | Reissued `plex.direct` cert chained to Let's Encrypt Root YR without the X1 cross-sign, so plex.tv's probe failed with `unknown ca` | Fixed (cert renamed → reissued) |
- **Plugins and Docker containers update automatically every week** (CA Auto Update Applications, user, 2026-10-20).
  This was set up after the Plex compromise, which a timely update would have prevented. Monitoring:
  `infra/cluster-config/docs/alerting.md` → "Tower (Unraid)".
- **Update the BIOS before an Unraid major upgrade.** On 2026-10-18 the upgrade from 6.12.9 (kernel 6.1.82) to 7.3.3 hung
  right after the board's boot splash, before the OS loaded. The screen stayed black, the box was unreachable, and
  the power button cut it off instantly. The new kernel wouldn't boot with the board's 2024 BIOS, and a BIOS update
  fixed it. Have a monitor and keyboard on hand for the first boot.
- Kernels below 6.1.129 / 6.6.79 / 6.12.16 can deadlock nfsd and wedge every k8s NFS client:
  [`infra/cluster-config/docs/issues/2026_10_18_unraid_nfs_v41_client_wedge.md`](../../infra/cluster-config/docs/issues/2026_10_18_unraid_nfs_v41_client_wedge.md).
  Recovery runbook: `infra/cluster-config/docs/postgres_backup.md` → "When the backup share hangs".

## k8s-ainode: GPU node (192.168.0.38)

The cluster's only GPU. `ssh k8s-ainode` from WSL. The hostname is `daniel-ainode1` and the k8s node name matches.

| | |
|---|---|
| CPU / RAM | Ryzen 5 5600G, 32 GB (user). k8s allocatable: 12 CPU, ~31 GiB (verified) |
| GPU | RTX 3080 12 GB (verified `nvidia-smi`) |
| Case | Fractal Node 804 on a steel shelf. One front intake fan feeds the GPU. The card is 2.5 slots wide and covers every PCIe slot, so the 10G NIC is on a PCIe extension (user) |
| OS | Ubuntu 24.04.5 LTS, kernel `7.0.0-38-generic` (HWE), boots to `multi-user.target`. The desktop is installed but doesn't start (verified 2026-10-25) |
| Driver | `580.196.07` open, DKMS, from NVIDIA's CUDA repo only (verified). Mixing it with Ubuntu-archive drivers breaks apt: [record](2026_10_25_ainode_nvidia_575_580_file_conflict.md) |
| Power limit | **280 W** (stock 350 W). Set at boot by `/etc/systemd/system/nvidia-power-limit.service`, which runs `nvidia-smi -pm 1` and then `-pl 280` (verified) |
| Cluster | microk8s `1.35/stable`, v1.35.6. Joined 2026-10-25 as a **full control-plane node, and it's a dqlite voter**. `k8s-worker2` is now the standby (verified `microk8s status`). The `nvidia` addon is enabled with `--gpu-operator-driver host`, and the node advertises `nvidia.com/gpu: 1` |
| Host exporters | **None. k8s owns ports 9100 and 9400.** Removed 2026-10-25: a pre-k8s systemd `node_exporter.service` (`/opt/node_exporter`) held 9100 and crash-looped the cluster's node-exporter pod, and a standalone Docker `dcgm-exporter` (restart `always`) held 9400 next to the GPU operator's (verified). They may have come from an Ansible playbook run elsewhere; no trace of one was found on the box or in the workspace. Re-running such a playbook would put them back |

**Thermal baseline.** `nvidia-smi` readings during a 5-minute fp16 matmul burn,
[`evidence/2026_10_25_ainode_gpu_burn_job.yaml`](evidence/2026_10_25_ainode_gpu_burn_job.yaml). Both runs were in the final shelf position with one front intake (verified 2026-10-25):

| Limit | fp16 TFLOPS | Steady temp | GPU fan | SM clock | What limits it |
|---|---|---|---|---|---|
| 350 W | 66.8, falling to 61.5 and not settled | 83 °C | 96% | 1905 → 1815 MHz | heat (`0x20`, thermal slowdown) |
| 280 W | 61.3, settling at 60.0 | 82 °C | 92–94% | 1800 → 1725 MHz | power cap only (`0x4`) |

The 280 W run holds a steady speed. The GPU fan has almost no headroom left, so airflow is what limits this box. A top intake fan
blowing down onto the card is planned (user). To measure it, re-run the Job and compare the steady fan % against the 280 W row:
`ssh k8s-main 'microk8s kubectl apply -f -' < docs/machines/evidence/2026_10_25_ainode_gpu_burn_job.yaml`. Delete the previous
`gpu-burn-test` Job first if it's still there. It deletes itself an hour after it finishes.

| Record | Root cause | Status |
|---|---|---|
| [2026_10_25 — NVIDIA 575 and 580 file conflict](2026_10_25_ainode_nvidia_575_580_file_conflict.md) | Ubuntu-archive 575 and CUDA-repo 580 installed together. The 580 packages can't overwrite files 575 owns, so ~40 packages are left `iU` | Fixed |

`evidence/` holds artefacts small and safe enough to commit. **Raw core dumps are deliberately not
kept** — see the evidence section of the Xorg record for why.
