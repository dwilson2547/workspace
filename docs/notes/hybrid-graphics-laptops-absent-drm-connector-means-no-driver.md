---
title: Hybrid-graphics laptops: absent DRM connector means no driver bound, not a bad cable
date: 2026-09-06
tags: nvidia,hybrid-graphics,drm,xorg,ubuntu,kernel-modules
source: docs/machines/2026_09_06_nvidia_module_missing_hdmi_not_detected.md
---

On hybrid AMD+NVIDIA laptops the HDMI/DP ports are often wired to the discrete GPU, so if the NVIDIA kernel module is missing the port does not appear in /sys/class/drm at all. A connector listed as 'disconnected' means a driver is bound and the cable is out; a connector that is entirely absent means the owning GPU has no driver — check 'lspci -nnk' for a missing 'Kernel driver in use' line before suspecting hardware. Ubuntu's prebuilt linux-modules-nvidia-<ver>-<kernel> packages pin to one exact kernel ABI and silently stop tracking after a kernel upgrade, leaving userspace intact so dpkg looks healthy; nouveau is blacklisted by those same packages so nothing claims the GPU. Fix is the matching module package (which will also drag in a newer kernel) or nvidia-dkms-<ver> to be immune to drift. Critically: never let that install run inside a live graphics session with an external display attached — loading nvidia_drm modeset=1 mid-session makes the compositor hot-adopt a new GPU and a live output at once, which hung mutter hard enough to need REISUB. Do it from a TTY with the display unplugged.
