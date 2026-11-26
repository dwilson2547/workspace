# Plugging in the DisplayLink dock: WirePlumber spins at 100% CPU, and one dock monitor sometimes stays dark

**Date:** 2026-11-25  
**Component:** `wireplumber` 0.4.17 (ALSA monitor), `displaylink-driver` 6.4.0 / `evdi` 1.15.1, GNOME (mutter 46.2) on Xorg  
**Severity:** Medium — laptop sluggish after every dock plug-in; one external monitor intermittently off until a replug  
**Related:** [2026_11_23 — NVIDIA modules missing again](2026_11_23_nvidia_modules_lag_kernel_recurrence.md) (its "DisplayLink replug" finding is the first sighting of fault 1)

**Hardware:** HP Pavilion Gaming Laptop 15-ec2xxx, Anker Prime Docking Station A83B3 (DisplayLink `17e9:7000`), two 1080p monitors  
**OS:** Ubuntu 24.04, kernel `7.0.0-43-generic`, session type `x11`, NVIDIA 580.178.04 loaded and healthy (not involved)

Two separate faults, both triggered by plugging in the dock. Neither is a GPU-driver problem.

---

## Fault 1 — WirePlumber spins at 100% CPU after the dock is plugged in

### Observed

The user reported the laptop "fucky again after plugging in the dock". Measured about three minutes after the plug:

```
top                      → wireplumber (pid 33331, nice -11) 100% CPU; load 1.5; everything else idle
Xorg log 22:56:21        → Logitech G305: client bug: event processing lagging behind by 47ms, your system is too slow
ls -l /proc/33331/fd     → 36 -> /dev/snd/controlC2 (deleted)
                           38 -> /dev/snd/controlC2 (deleted)
                           40 -> /dev/snd/controlC2
wpctl status             → dock audio card (A83B3_A1) absent, although /proc/asound/cards listed it as card 2
```

### Root cause

The dock's DisplayLink device drops off USB about a second after it first enumerates, then returns:

```
22:55:02 usb 2-1.3: New USB device found, idVendor=17e9, idProduct=7000
22:55:03 usb 2-1.3: USB disconnect, device number 9
22:55:03 wireplumber: Error fetching PCM info: No such device
22:55:03 wireplumber: ALSA close failed: No such device
22:55:03 wireplumber: can't open control for card hw:2: No such file or directory
22:55:05 usb 2-1.3: new SuperSpeed USB device number 11
```

WirePlumber was probing the dock's USB audio card when it vanished, was left holding handles to the deleted control
device, and burned one core from that second on (`ps` CPU time tracked wall-clock time since the plug).

**Same signature on 2026-11-24:** identical `hw:2` errors at 22:02:59, and the WirePlumber instance that was restarted at
22:08:32 had `Consumed 5min 32.632s CPU time` — the full interval since the plug. A restart clears it; the next plug brings
it back. That is why two earlier attempts did not stick.

**⚠ unverified:** the exact loop inside WirePlumber/PipeWire (`strace` attach was refused by ptrace restrictions).
Presumed: polling a dead ALSA control handle that reports an error forever. Also unverified: why the DisplayLink device
re-enumerates (it did so on 11-24 and on the first plug of 11-25, but not on the 23:01 replug).

### Fix

The dock's audio jack is unused (user, 2026-11-25), so WirePlumber is told to ignore the card and never opens it:

`~/.config/wireplumber/main.lua.d/51-ignore-displaylink-audio.lua`

```lua
table.insert(alsa_monitor.rules, {
  matches = { { { "device.name", "matches", "alsa_card.usb-DisplayLink_*" } } },
  apply_properties = { ["device.disabled"] = true },
})
```

`/usr/share/wireplumber/scripts/monitors/alsa.lua:281` returns before creating the device when `device.disabled` is set.

**Status: fixed, verified across one real replug.** After `systemctl --user restart wireplumber`, the process holds only
`controlC0` and `controlC1`. The user unplugged and replugged the dock at 23:01:36–23:01:46; 45 s later WirePlumber
(same pid) was at 0.0% CPU with no handle on `controlC2`. Caveat: that replug did not include the mid-enumeration USB
drop, so the original trigger was not reproduced — the fix rests on the card never being opened.

Undo: delete the file, restart `wireplumber`. Side effect: the dock's headphone jack and S/PDIF input are not offered as
audio devices.

---

## Fault 2 — one dock monitor "connected" but switched off after a plug-in

### Observed

After the 23:01 replug only one external monitor lit. The user has seen this before and cleared it by replugging.

```
xrandr (40 s after plug)        → DVI-I-2-1 connected            (no geometry, no modes listed)
                                  DVI-I-3-2 connected 1920x1080+1920+0
                                  eDP connected primary 1920x1080+0+0      (saved layout has eDP at +1039+1080)
/sys/class/drm/card3-DVI-I-1    → status connected, enabled disabled, edid 256 bytes, modes present
Xorg log 23:01:47               → AMDGPU(0): Allocate new frame buffer 3840x1080     (two screens, not three)
mutter GetCurrentState          → knows DVI-I-2-1 as AUS VG249Q3A, but it is in no logical monitor
```

### Cause (hypothesis, consistent with the above)

GNOME laid the screens out in the same second the dock appeared (framebuffer sized for two screens at 23:01:47), before
X had modes for the second dock monitor. The kernel had the EDID and modes; X showed modes for the output on a later
query; GNOME by then knew the monitor's identity — but nothing re-applied the saved three-monitor layout.
**⚠ unverified:** which component drops the late update (evdi's hotplug signalling, the X modesetting driver, or mutter's
hotplug detection). Not investigated further; the workaround below does not depend on it.

### Immediate fix

```bash
xrandr --output DVI-I-2-1 --mode 1920x1080 --rate 60 --pos 0x0 --output DVI-I-3-2 --mode 1920x1080 --pos 1920x0 \
       --output eDP --mode 1920x1080 --rate 144 --pos 1039x1080 --primary
```

Monitor came back; user confirmed.

### Workaround installed

`~/.local/bin/dock-display-settle` run by the user unit `~/.config/systemd/user/dock-display-settle.service`
(`WantedBy=graphical-session.target`, X11 sessions only). It listens for `drm` udev events, waits 4 s of quiet, checks
again 12 s later, and if a connected monitor that the matching layout in `~/.config/monitors.xml` says should be on is
off, applies that layout with `xrandr`. Layouts are matched on connector + vendor + product + serial (from mutter over
D-Bus). It does nothing when no saved layout matches, when the layout uses rotation or scaling, or for a monitor the
saved layout lists as disabled.

**Status: workaround verified against a simulated fault only.** `xrandr --output DVI-I-2-1 --off` was undone by the
service within 5 s (`dark: ['DVI-I-2-1']; applied saved layout (rc=0)`), and `monitors.xml` was byte-identical
afterwards. **⚠ unverified** against a real dark-monitor plug-in — the race is intermittent and has not recurred since
the service was installed. If a monitor stays dark after a plug, read
`journalctl --user -u dock-display-settle` first: `skip:` lines say why it declined to act.

Consequence to know about: switching a monitor off with bare `xrandr` is now reverted at the next display hotplug event.
Switching it off in GNOME Settings is respected, because that rewrites `monitors.xml`.

Undo: `systemctl --user disable --now dock-display-settle` and delete the two files.

---

## Files changed (all user-level, outside the repo)

- `~/.config/wireplumber/main.lua.d/51-ignore-displaylink-audio.lua` — new
- `~/.local/bin/dock-display-settle` — new
- `~/.config/systemd/user/dock-display-settle.service` — new, enabled
