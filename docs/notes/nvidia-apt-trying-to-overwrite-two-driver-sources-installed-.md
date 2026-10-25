---
title: NVIDIA apt 'trying to overwrite' = two driver sources installed; purge the old series
date: 2026-10-25
tags: nvidia,apt,dpkg,cuda,ubuntu,drivers
source: docs/machines/2026_10_25_ainode_nvidia_575_580_file_conflict.md
---

When apt upgrade fails on nvidia-kernel-common-<new>, libnvidia-compute-<new> or libnvidia-gl-<new>, the summary hides the cause: grep /var/log/apt/term.log for 'trying to overwrite'. If the owner is a different driver series (e.g. nvidia-utils-575 from the Ubuntu archive while 580 comes from NVIDIA's CUDA repo), two driver sources are installed. Every dependent package then stays iU and apt refuses all installs, even linux-headers. --fix-broken alone does not resolve it. Fix: dpkg --purge --force-depends every package matching nvidia+<old series>, then apt --fix-broken install && apt full-upgrade, then confirm dkms status lists the new series for the running kernel. Keep one source afterwards (don't mix ubuntu-drivers with the CUDA repo). A box rebooted mid-break may come up without sshd: GRUB recovery mode -> root shell -> dpkg --configure -a.
