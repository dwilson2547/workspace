# Ubuntu-archive NVIDIA 575 and CUDA-repo NVIDIA 580 both installed, so the 580 packages can't overwrite files 575 still owns and `apt upgrade` stops halfway

**Date:** 2026-10-25  
**Component:** NVIDIA driver packages on `daniel-ainode1`: `nvidia-utils-575` and `libnvidia-extra-575` (Ubuntu archive) against `nvidia-kernel-common-580`, `libnvidia-compute-580` and `libnvidia-gl-580` (`/etc/apt/sources.list.d/cuda-ubuntu2404-x86_64.list`)  
**Severity:** High. No usable GPU driver, about 40 NVIDIA, CUDA and container-toolkit packages left half-installed (`iU`), and sshd not running after the next reboot.

**Hardware:** k8s-ainode (see [README](README.md#k8s-ainode-gpu-node-1921680038))  
**OS:** Ubuntu 24.04.5 LTS, kernel `6.17.0-20-generic` at the time, `7.0.0-38-generic` after the fix

---

## Observed symptom

`apt update && apt upgrade` ended with (user):

```
Errors were encountered while processing:
 /tmp/apt-dpkg-install-GYY0S4/00-nvidia-kernel-common-580_580.196.07-1ubuntu1_amd64.deb
 /tmp/apt-dpkg-install-GYY0S4/15-libnvidia-compute-580_580.196.07-1ubuntu1_amd64.deb
 /tmp/apt-dpkg-install-GYY0S4/19-libnvidia-gl-580_580.196.07-1ubuntu1_amd64.deb
E: Sub-process /usr/bin/dpkg returned an error code (1)
```

That summary leaves out the cause. The cause is next to each `Unpacking` line in `/var/log/apt/term.log`.

## Root cause

Two driver series from two sources were installed at once (verified, `dpkg -l` and the apt sources):

- **575** from the Ubuntu archive, `575.64.03-0ubuntu0.24.04.x`. Its only prebuilt module was `linux-modules-nvidia-575-open-6.14.0-29-generic`. The box was running 6.17.0-20, so the driver had probably not loaded since an earlier kernel upgrade (⚠ unverified: nobody checked `nvidia-smi` before the fix).
- **580** from NVIDIA's CUDA repo, `580.196.07-1ubuntu1`, pulled in by the upgrade.

The 580 packages ship files that 575 packages still owned, so dpkg refused to unpack them (verified, `term.log`):

| 580 package | File | Owned by |
|---|---|---|
| `nvidia-kernel-common-580` | `/usr/bin/nvidia-bug-report.sh` | `nvidia-utils-575` |
| `libnvidia-compute-580` | `/usr/bin/nvidia-debugdump` | `nvidia-utils-575` |
| `libnvidia-gl-580` | `/usr/lib/x86_64-linux-gnu/gbm/nvidia-drm_gbm.so` | `libnvidia-extra-575` |

Every package that depends on those three stayed unconfigured. After that, apt refuses any install, even an unrelated one like `linux-headers-$(uname -r)`, with "Unmet dependencies. Try 'apt --fix-broken install'".

## sshd down after the reboot

The box rebooted while packages were in this state. Afterwards it answered ping and node_exporter (9100), but refused 22 and the kubelet on 10250 (verified from WSL). Its uptime from node_exporter matched the reboot. The reason sshd didn't start was not diagnosed (⚠ unverified). The display stayed dark on both the GPU and the motherboard ports while the box was running (user).

The way back in (user):

1. Plug the monitor into the 3080 **before** powering on. Most AM4 boards disable the 5600G's integrated graphics when a discrete GPU is installed.
2. Tap Esc after the BIOS splash, then choose *Advanced options*, *(recovery mode)*, *root*. Recovery mode boots with `nomodeset`.
3. `mount -o remount,rw /`, `dpkg --configure -a`, `systemctl enable --now ssh.socket ssh.service`.

## Fix

Remove every 575 package, then let 580 finish (verified: these were run, and each result below was checked over ssh):

```bash
sudo dpkg --purge --force-depends $(dpkg -l | awk '$2 ~ /nvidia/ && $2 ~ /575/ {print $2}')
sudo apt --fix-broken install -y && sudo apt full-upgrade -y
dkms status
sudo reboot
```

After the purge, `dpkg -S` found no owner for the three conflicting files. After the upgrade, `dpkg -l` showed no `iU` packages, and `dkms status` showed `nvidia/580.196.07` built for `6.17.0-20-generic` and `7.0.0-38-generic`. After the reboot, `nvidia-smi` reported the RTX 3080 on `580.196.07`.

**Keep one driver source.** The CUDA repo is the source now. A future `ubuntu-drivers install` or a `nvidia-driver-5xx` package from the Ubuntu archive would bring this conflict back.
