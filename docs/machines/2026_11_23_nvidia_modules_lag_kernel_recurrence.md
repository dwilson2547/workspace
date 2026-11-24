# NVIDIA kernel modules again missing for the running kernel: the metapackage that was meant to prevent drift fell behind

**Date:** 2026-11-23  
**Component:** `linux-modules-nvidia-580-open-*` (prebuilt module packages), `linux-modules-nvidia-580-open-generic-hwe-24.04` (flavour metapackage)  
**Severity:** Medium — no display or session failure this time, but the dGPU was driverless and video playback on the DisplayLink screens was slow  
**Recurrence of:** [2026_09_06 — NVIDIA modules stop tracking the kernel](2026_09_06_nvidia_module_missing_hdmi_not_detected.md)

**Hardware:** HP Pavilion Gaming Laptop 15-ec2xxx — AMD Cezanne iGPU (`05:00.0`) + NVIDIA TU117M GTX 1650 Mobile/Max-Q (`01:00.0`), plus a DisplayLink dock (two DVI-I monitors via `evdi` 1.15.1)  
**OS:** Ubuntu 24.04, running kernel `7.0.0-43-generic`, GNOME on Wayland, Secure Boot enabled, `prime-select` = `on-demand`

---

## Observed symptom

The user reported the internet being "extremely slow" and suspected the laptop. After a reboot that cleared the first
symptoms (see *Related findings*), YouTube stayed slow once the DisplayLink dock was reconnected. Nothing reported an
error. The NVIDIA driver was selected in Ubuntu's Additional Drivers tool, and `dpkg -l` looked healthy.

```
nvidia-smi   → NVIDIA-SMI has failed because it couldn't communicate with the NVIDIA driver.
xrandr --listproviders → Providers: number : 0
```

---

## Root cause

### The running kernel had no matching prebuilt module package

```
uname -r                         → 7.0.0-43-generic
lsmod | grep nvidia              → (nothing)
modinfo nvidia                   → ERROR: Module nvidia not found.
installed module packages        → linux-modules-nvidia-580-open-7.0.0-28-generic
                                   linux-modules-nvidia-580-open-7.0.0-31-generic
dkms status                      → evdi/1.15.1, 7.0.0-43-generic: installed   (no nvidia)
lspci -nnk, 01:00.0              → Kernel modules: nvidiafb, nouveau          (no "Kernel driver in use:")
```

Same signature as September: the userspace stack (`nvidia-driver-580-open` 580.173.02) was installed and intact, which
hides the fault. Only the kernel-side module was missing.

### The metapackage did not follow the kernel

The September record concluded the failure "will not recur" while the flavour metapackage tracked the kernel. It did not:

```
linux-modules-nvidia-580-open-generic-hwe-24.04
  Installed: 7.0.0-31.31~24.04.1
  Candidate: 7.0.0-43.43~24.04.1   (noble-updates/restricted and noble-security)
```

The `-43` module package was available and simply not installed. Nothing was blocking it: `apt-mark showhold` was empty,
`/etc/apt/preferences.d/` held only the Ubuntu Pro ESM pins, and `APT::Periodic::Unattended-Upgrade "1"` was on.

**Timeline (verified from `/var/log/apt/history.log`, `/var/log/dpkg.log`, `last -x reboot`):**

| When | What |
|---|---|
| 2026-11-13 06:35 | `unattended-upgrade` installed `linux-image-7.0.0-43-generic` and `linux-modules-7.0.0-43-generic`. No NVIDIA module package came with it. The machine kept running `7.0.0-31` (up since 2026-09-25) |
| 2026-11-22 23:43 | First boot into `7.0.0-43` (after the machine had been off). The NVIDIA driver is missing from here on |
| 2026-11-22 23:52 | `apt install displaylink-driver` installed only `displaylink-driver`, `evdi` and `dkms`. **It did not touch the kernel or NVIDIA packages.** It came nine minutes after the first `-43` boot |
| 2026-11-23 23:56 | `-43` module package installed (the fix below) |

A pending kernel only takes effect at the next reboot, so the driver gap stayed hidden for nine days. **The DisplayLink install
was a coincidence of timing, not the cause**: the missing driver was already in place before it ran.

**⚠ unverified:** why the `-43` kernel arrived without its modules. The plausible mechanism is that the `-43` NVIDIA module
package was not yet in the archive on 2026-11-13, so the kernel metapackage upgraded alone and the NVIDIA metapackage
stayed at `-31`. The archive's publish date for the `-43` modules was not checked.

---

## Troubleshooting steps taken

1. **Checked Wi-Fi and network** — gateway ping averaged 99 ms (max 148 ms). Pointed at the local Wi-Fi, but the user's
   phone was fine on the same network, so the laptop was the likely cause. `rtw89` power-save was on (see *Related findings*).
2. **Reboot** — cleared the latency spikes and audio problem. ⚠ unverified cause.
3. **Reconnected the DisplayLink dock** — ping stayed steady (max 10 ms), so the network was ruled out. YouTube was still
   slow. CPU load was low (about 1.1), so this was not CPU saturation.
4. **Checked the display stack** — Wayland session, three monitors (`eDP-1`, `DVI-I-1`, `DVI-I-2`).
   `nvidia-smi` failed. The user said the driver was selected in Additional Drivers.
5. **Compared installed module packages with the running kernel** — `-28` and `-31` only. Found the root cause.
6. **Checked `apt-cache policy`** — the `-43` module package and the metapackage upgrade were both available.
7. **Searched the workspace docs** (after the user pointed to `~/documents/workspace`) — found the September record, which
   showed this was a recurrence.

---

## Fix

```bash
sudo apt install linux-modules-nvidia-580-open-7.0.0-43-generic linux-modules-nvidia-580-open-generic-hwe-24.04
sudo reboot
```

`/var/log/apt/history.log`, start 2026-11-23 23:56:42:

```
Install: linux-modules-nvidia-580-open-7.0.0-43-generic (7.0.0-43.43~24.04.1), nvidia-firmware-580-580.178.04
Upgrade: linux-modules-nvidia-580-open-generic-hwe-24.04  7.0.0-31.31 → 7.0.0-43.43
         nvidia-driver-580-open  580.173.02 → 580.178.04  (+ the rest of the 580 stack)
Remove:  linux-modules-nvidia-580-open-7.0.0-28-generic
```

**Status: fixed and verified.** Package install is in the apt log. After the reboot (user, 2026-11-24), `nvidia-smi` reports the
GTX 1650 on driver `580.178.04` under kernel `7.0.0-43-generic`, `modinfo -F version nvidia` agrees, the session type is `x11`,
and `xrandr --listproviders` lists the NVIDIA provider. ⚠ unverified: whether YouTube on the dock screens improved; the user
has not said.

**Expected side effect, not a new fault:** with the NVIDIA driver loaded, the GDM greeter and the first desktop start crash once
and then come up on the second try. That is the long-standing, root-caused-but-unfixed
[RRTellChanged use-after-free](2026_09_06_xorg_greeter_crash_rrtellchanged.md). It only shows while the driver works, so it
returned as soon as this fix landed.

### Hazard from September was not followed

The September record warns that installing NVIDIA modules inside a running graphics session hard-locked the machine, and
recommends a TTY with external displays unplugged. This install was done in the normal session with the dock connected,
because that record had not been consulted. No freeze was reported. Do not rely on that: next time use
`sudo systemctl isolate multi-user.target` (or `Ctrl+Alt+F3`) with the dock unplugged.

---

## Decision pending: stop relying on the metapackage

Two prebuilt-module lags in under three months suggest the metapackage approach does not hold. The option from the September
record still applies:

```bash
sudo apt install nvidia-dkms-580-open
```

DKMS rebuilds against whichever kernel is installed, so it cannot fall behind, at the cost of a compile on each kernel
update. Points for the decision:

- **Secure Boot is enabled** and the `evdi` DKMS module is loaded on this machine (`lsmod`, `dkms status` above). That
  suggests module signing already works here, so a MOK enrollment is probably not a new obstacle. ⚠ unverified (inferred; MOK state not checked with `mokutil`).
- **Do not mix Ubuntu-archive and NVIDIA CUDA-repo drivers.** That broke apt on the ainode:
  [2026_10_25 — NVIDIA 575 and 580 file conflict](2026_10_25_ainode_nvidia_575_580_file_conflict.md). This laptop uses the
  Ubuntu archive only; keep it that way.
- **Cheap detection instead:** after any kernel update, run `nvidia-smi`, or compare `uname -r` against
  `dpkg -l | grep linux-modules-nvidia`.

---

## Related findings, not shown to be caused by the above

- **Wi-Fi latency spikes** (1 ms to 80 ms to a LAN address). The chip is a Realtek RTL8852AE (`rtw89_8852ae`).
  `/etc/NetworkManager/conf.d/default-wifi-powersave-on.conf` sets `wifi.powersave = 3`, and the driver's
  `disable_aspm_l1`, `disable_aspm_l1ss` and `disable_ps_mode` were all `N`. The spikes cleared after a reboot and
  these settings were **not changed**, so if the spikes return, those are the first suspects.
- **DisplayLink replug.** A quick unplug and replug of the dock made the USB audio card (`hw:1`) vanish from WirePlumber at
  23:30:19, with `evdi: Double connect` logged at 23:48:37. Both settled after the reboot.
- **DisplayLink on Wayland** is the weakest combination for video. If the NVIDIA fix leaves YouTube slow on the dock
  screens, try "GNOME on Xorg" at the login screen. (With the NVIDIA driver loaded, Ubuntu's GDM rules may prefer Xorg anyway.)

---

## Files changed

- `linux-modules-nvidia-580-open-7.0.0-43-generic` — installed (package state)
- `linux-modules-nvidia-580-open-generic-hwe-24.04` — upgraded `7.0.0-31.31~24.04.1` → `7.0.0-43.43~24.04.1`
- `nvidia-driver-580-open` — upgraded `580.173.02` → `580.178.04`
- No source or configuration files modified.
