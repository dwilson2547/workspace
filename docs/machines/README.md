# machines

Triage records for the dev machines this workspace is built on — hardware, kernel, driver and
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

`evidence/` holds artefacts small and safe enough to commit. **Raw core dumps are deliberately not
kept** — see the evidence section of the Xorg record for why.
