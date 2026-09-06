# Prebuilt NVIDIA kernel modules stop tracking the running kernel, leaving the dGPU driverless and its attached HDMI port invisible to the OS

**Date:** 2026-09-06  
**Component:** `linux-modules-nvidia-580-open-*` (prebuilt module packages), `/lib/modprobe.d/nvidia-graphics-drivers.conf` — nouveau blacklist  
**Severity:** High — external display completely unusable; the obvious remediation hard-locks the machine if performed inside a running graphics session

**Hardware:** HP Pavilion Gaming Laptop 15-ec2xxx — hybrid AMD Cezanne iGPU (`05:00.0`) + NVIDIA TU117M GTX 1650 Mobile/Max-Q (`01:00.0`)  
**OS:** Ubuntu 24.04.3 LTS, GNOME Shell 46.0 / mutter 46.2

---

## Observed symptom

An external monitor connected over HDMI was not detected at all. Not "detected but blank" — the
operating system had no notion that an HDMI port existed.

`/sys/class/drm` listed exactly one connector, the internal panel:

```
card1-eDP-1 status=connected enabled=enabled topmode=1920x1080
```

`xrandr` agreed, reporting only `eDP-1`. Critically, **no `HDMI-A-*` connector appeared in any
state** — a connector wired to a bound GPU is enumerated as `disconnected` even with no cable
attached, so its total absence indicated the owning GPU had no driver.

---

## Root cause

### The HDMI port is wired to the discrete NVIDIA GPU, not the AMD iGPU

On this chassis the physical HDMI jack is routed to the dGPU. The AMD iGPU exposes only the
internal eDP panel. Once the NVIDIA driver was loaded, the connector appeared under the NVIDIA
DRM card, confirming the routing:

```
card1 -> nvidia    card1-HDMI-A-1
card2 -> amdgpu    card2-eDP-1
```

Consequence: with no NVIDIA driver, there is no HDMI output on this machine at all. The port is
electrically present but has no software owner.

### Prebuilt NVIDIA module packages do not follow kernel upgrades

The system used Ubuntu's *prebuilt* module packages (`linux-modules-nvidia-580-open-<kernel>`)
rather than DKMS — `dkms status` returned empty. Each such package is pinned to one exact kernel
ABI. The running kernel had advanced past the newest installed module package:

```
uname -r                 → 7.0.0-28-generic
installed module pkg     → linux-modules-nvidia-580-open-6.17.0-14-generic
modinfo nvidia           → ERROR: Module nvidia not found
```

The NVIDIA *userspace* stack (`nvidia-driver-580-open` 580.126.09) was installed and intact, which
masks the problem: `dpkg -l` looks healthy and nothing reports an error. Only the kernel-side
module was absent. `lspci -nnk` showed the tell:

```
01:00.0 NVIDIA Corporation TU117M [GeForce GTX 1650 Mobile / Max-Q]
	Kernel modules: nvidiafb, nouveau        ← no "Kernel driver in use:" line
```

### The nouveau fallback is blacklisted, so nothing claims the GPU

Normally nouveau would bind the GPU and provide basic output. The NVIDIA driver packages disable
it:

```
/lib/modprobe.d/nvidia-graphics-drivers.conf:1: blacklist nouveau
/lib/modprobe.d/nvidia-graphics-drivers.conf:5: alias nouveau off
```

With `nvidia` unbuilt and `nouveau` blacklisted, the dGPU was claimed by no driver whatsoever, so
the kernel never created a DRM card for it and never enumerated its connectors.

---

## Troubleshooting steps taken

1. **Enumerated DRM connectors under `/sys/class/drm`** — only `card1-eDP-1` present. Ruled out a
   cable, monitor, or mode-negotiation fault: the OS was not failing to light the port, it did not
   know the port existed.

2. **Checked GPU inventory with `lspci -k`** — confirmed hybrid AMD + NVIDIA. Noted the NVIDIA
   entry listed `Kernel modules:` but no `Kernel driver in use:`, indicating nothing was bound.

3. **Checked loaded modules with `lsmod`** — `amdgpu` present; no `nvidia`, no `nouveau`. Confirmed
   the dGPU was entirely unclaimed rather than bound-but-misbehaving.

4. **Looked for the module on disk** — `find /lib/modules/$(uname -r) -name 'nvidia*.ko*'` returned
   only `nvidiafb` and `nvidia-wmi-ec-backlight`, not the driver. `modinfo nvidia` errored. Ruled
   out a load-time failure; the module was never built for this kernel.

5. **Compared package versions against the running kernel** — installed module package targeted
   `6.17.0-14-generic` while the running kernel was `7.0.0-28-generic`. Identified the version
   drift as the root cause.

6. **Checked for a nouveau fallback** — found the blacklist in
   `/lib/modprobe.d/nvidia-graphics-drivers.conf`, explaining why no driver at all had bound.

7. **Confirmed after remediation** — `card1-HDMI-A-1` appeared, `nvidia-smi` reported the GPU, and
   the external monitor was driven successfully.

---

## Fix

### Install the module package matching the running kernel

```bash
sudo apt install linux-modules-nvidia-580-open-7.0.0-28-generic
sudo reboot
```

**Be aware this transaction is much larger than it appears.** A versioned module package depends on
its matching `linux-image`, so apt pulled in an entire additional kernel and upgraded the whole
NVIDIA stack:

```
Install: linux-image-7.0.0-31-generic, linux-modules-7.0.0-31-generic,
         linux-modules-nvidia-580-open-7.0.0-31-generic, nvidia-firmware-580-580.173.02
Upgrade: nvidia-driver-580-open 580.126.09 → 580.173.02 (+15 related packages)
Remove:  linux-modules-nvidia-580-open-6.17.0-14-generic
```

Review the transaction plan before confirming, and expect to land on a *newer* kernel than the one
requested.

### Verify the flavour metapackage is tracking the current kernel series

The underlying defect is the metapackage falling behind. After the upgrade it tracks correctly:

```
linux-modules-nvidia-580-open-generic-hwe-24.04   7.0.0-31.31~24.04.1
```

While this holds, future kernel upgrades pull matching modules automatically and the failure will
not recur. If it drifts again, either reinstall the flavour metapackage or switch to DKMS:

```bash
sudo apt install nvidia-dkms-580-open
```

DKMS rebuilds against whatever kernel is installed and is immune to this class of drift, at the
cost of a compile on every kernel update.

### HAZARD: do not install NVIDIA modules inside a running graphics session

**This step hard-locked the machine and required a REISUB to recover.** Sequence from the journal:

```
23:32:55  kernel: nvidia: loading out-of-tree module taints kernel
23:33:22  gsd-xsettings: Failed to get current display configuration state: Timeout was reached
```

The package postinstall loaded `nvidia` and `nvidia_drm` (with `modeset=1`, per
`/etc/modprobe.d/nvidia-graphics-drivers-kms.conf:3`) **live, into a running GNOME Wayland
session**. A brand-new DRM device appeared carrying an HDMI output **with a monitor already
connected to it**. 27 seconds later mutter's display-configuration service stopped responding and
the session froze.

The external display being connected during the install is believed to be an aggravating factor:
the compositor had to hot-adopt an unfamiliar GPU *and* negotiate a mode on an already-live output
simultaneously. An empty port presents nothing to negotiate.

Mitigation — do the install from a text console with the external display unplugged:

```bash
sudo systemctl isolate multi-user.target   # or Ctrl+Alt+F3 and log in on a TTY
sudo apt install linux-modules-nvidia-580-open-<kernel>
sudo reboot
```

Two notes on the recovery itself:

- The `amdgpu ... Not enough memory for command submission!` flood in the log is timestamped
  **after** the sysrq Emergency Remount R/O. It is teardown noise, not the cause. Do not chase it.
- REISUB was only partially honoured — `sysrq: This sysrq operation is disabled` appeared three
  times because `/proc/sys/kernel/sysrq` was `176`. Only S, U and B executed. Set it to `1` if the
  full sequence is wanted:

```bash
echo 'kernel.sysrq = 1' | sudo tee /etc/sysctl.d/99-sysrq.conf
```

---

## Aftermath and related behaviour

- **The session switched from Wayland to X11.** `loginctl` reports `Type=x11`. This is intentional
  Ubuntu behaviour, not a fault: `/usr/lib/udev/rules.d/61-gdm.rules:79` routes any vendor NVIDIA
  driver ≥510 to `gdm_prefer_xorg`. Both session types remain selectable at the login screen.
- **The display is driven by reverse PRIME.** AMD renders, NVIDIA outputs:

  ```
  Provider 0: AMD Radeon Graphics  cap: Source Output, Sink Offload
  Provider 1: NVIDIA-G0            cap: Sink Output
  ```

- **`/sys/class/drm/card1-HDMI-A-1/status` reads `disconnected` even while the monitor is lit.**
  Under this arrangement the NVIDIA X driver owns the output as `DFP-0` and the DRM connector node
  is not updated. **Use `xrandr`, not sysfs, to check display state on this machine.** The output
  is named `HDMI-1-0` (provider 1, output 0), not `HDMI-A-1`.
- A pre-existing greeter crash on this machine is documented separately in
  [2026_09_06_xorg_greeter_crash_rrtellchanged.md](./2026_09_06_xorg_greeter_crash_rrtellchanged.md).

---

## Files changed

- `linux-modules-nvidia-580-open-7.0.0-28-generic` — installed (package state)
- `linux-modules-nvidia-580-open-generic-hwe-24.04` — upgraded to `7.0.0-31.31~24.04.1`
- `nvidia-driver-580-open` — upgraded `580.126.09` → `580.173.02`
- No source files modified; this was a packaging/configuration defect
