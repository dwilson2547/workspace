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
| OS | Unraid 7.3.3 (user), kernel `6.18.54-Unraid` (verified `uname -r`), since 2026-10-18 |
| NFS | `fs.leases-enable=0` (no delegations) set in `/boot/config/go`; nfsd threads raised to 64 (user, 2026-10-18) |

- **Update the BIOS before an Unraid major upgrade.** On 2026-10-18 the upgrade from 6.12.9 (kernel 6.1.82) to 7.3.3 hung
  right after the board's boot splash, before the OS loaded. The screen stayed black, the box was unreachable, and
  the power button cut it off instantly. The new kernel wouldn't boot with the board's 2024 BIOS, and a BIOS update
  fixed it. Have a monitor and keyboard on hand for the first boot.
- Kernels below 6.1.129 / 6.6.79 / 6.12.16 can deadlock nfsd and wedge every k8s NFS client:
  [`infra/cluster-config/docs/issues/2026_10_18_unraid_nfs_v41_client_wedge.md`](../../infra/cluster-config/docs/issues/2026_10_18_unraid_nfs_v41_client_wedge.md).
  Recovery runbook: `infra/cluster-config/docs/postgres_backup.md` → "When the backup share hangs".

`evidence/` holds artefacts small and safe enough to commit. **Raw core dumps are deliberately not
kept** — see the evidence section of the Xorg record for why.
