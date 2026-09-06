# Removing a GPU screen leaves it linked in the primary screen's secondary_list, so RRTellChanged dereferences the freed RandR private and kills the GDM greeter's X server

**Date:** 2026-09-06  
**Component:** `/usr/lib/xorg/Xorg` — `RRTellChanged` (`randr/randr.c:654`), `xf86platformRemoveDevice` (`hw/xfree86/common/xf86platformBus.c:738`), `DeleteGPUDeviceRequest` (`hw/xfree86/os-support/linux/lnx_platform.c:214`), `device_removed` (`config/udev.c:336`)  
**Severity:** Medium — use-after-free in the X server, but reached only during GPU teardown at greeter exit; self-recovering, costs one extra login per boot

**Hardware:** HP Pavilion Gaming Laptop 15-ec2xxx — hybrid AMD Cezanne iGPU (`05:00.0`, primary screen) + NVIDIA TU117M GTX 1650 Mobile/Max-Q (`01:00.0`, GPU/secondary screen)  
**OS:** Ubuntu 24.04.3 LTS, xorg-server `2:21.1.12-1ubuntu1.5`, GNOME Shell 46.0 / mutter 46.2, NVIDIA 580.173.02

**Status:** Root cause identified with a symbolised core dump. **No fix applied** — the defect is in the packaged `xorg-server`.

---

## Observed symptom

On boot, the GNOME login screen fails on the first attempt and bounces back to the greeter. The
second attempt always succeeds. Long-standing behaviour on this machine, present since Ubuntu was
installed.

The surfaced error blames GNOME Shell, which is misleading:

```
gnome-session-binary: Unrecoverable failure in required component org.gnome.Shell.desktop
```

GNOME Shell is the victim. It exits because its display server is already gone:

```
whoopsie-upload-all: Collecting info for /var/crash/_usr_lib_xorg_Xorg.120.crash
org.gnome.Shell.desktop: Failed to setup: Unable to open display ':0'
gnome-session-binary: WARNING: App 'org.gnome.Shell.desktop' exited with code 1
gnome-session-binary: WARNING: App 'org.gnome.Shell.desktop' respawning too quickly
gnome-session-binary: Unrecoverable failure in required component org.gnome.Shell.desktop
```

---

## Root cause

### Use-after-free: the freed GPU screen is still linked into `primary->secondary_list`

When the greeter's X server tears down, udev delivers remove events for the DRM devices.
`xf86platformRemoveDevice(index=0)` closes the NVIDIA **GPU screen** and frees its RandR private,
then — still inside the same function, at `xf86platformBus.c:738` — calls `RRTellChanged()` on the
primary screen. `RRTellChanged` walks `primary->secondary_list`, which **still contains the screen
that was just freed**, and dereferences its `rrScrPriv`.

The freed memory is provable from the core dump. In frame 11 (`RRTellChanged`):

```
primary                  = 0x5e79535c2ac0   myNum = 0   isGPU = 0      ← valid AMD primary
primary->secondary_list  = {next = 0x5e7954427410, prev = 0x5e7954427410}   ← one entry
iter                     = 0x5e7954426f70
iter->myNum              = 1398559344       ← garbage
iter->isGPU              = -1919777836      ← garbage
iter->current_primary    = 0x5e79535c2ac0   ← still points at the AMD primary
pSecondaryScrPriv        = 0x5e7954417470
```

`*pSecondaryScrPriv` carries the unmistakable signature of a freed glibc chunk — its first two
pointer-sized fields have been overwritten with free-list metadata:

```
rrSetConfig = 0x73999e403cd0 <main_arena+528>
rrGetInfo   = 0x73999e403cd0 <main_arena+528>
```

Those are the `fd`/`bk` pointers glibc writes into a chunk's user data when it is placed in a bin.
Both pointing at `main_arena+528` is what a lone chunk in an unsorted/small bin looks like. Only
the first 16 bytes were clobbered, which is why the rest of the struct still reads plausibly
(`width = 640, height = 480` — the unconfigured default for a GPU screen with no attached output,
consistent with `NVIDIA(GPU-0): DFP-0: disconnected` logged moments earlier).

### The `failed to find screen to remove` message is NOT the trigger

The log shows both DRM devices being removed, and it is tempting to read the AMD failure as the
cause. It is not:

```
(II) config/udev: removing GPU device .../0000:05:00.0/drm/card2   ← AMD
xf86: remove device 1 .../drm/card2
failed to find screen to remove                                    ← expected, harmless
(II) config/udev: removing GPU device .../0000:01:00.0/drm/card1   ← NVIDIA
xf86: remove device 0 .../drm/card1
(II) UnloadModule: "nvidia"
(EE) Backtrace:                                                    ← crash here
```

The AMD device backs the **primary** screen (`myNum = 0`, `isGPU = 0`), not a GPU screen.
`xf86platformRemoveDevice` searches only the GPU-screen list, does not find it, and logs
`failed to find screen to remove`. That is correct behaviour and it returns cleanly.

The crash happens on the *next* removal — the NVIDIA GPU screen, `index=0`, where frame 12 shows
`found = 1`. The device was found, torn down, freed, and then walked.

### Signal: SIGSEGV converted to SIGABRT

The crash report records `Signal: 6 (SIGABRT)`, which is misleading on its own. The original fault
was **SIGSEGV**, preserved in frame 8:

```
#8 OsSigHandler (unused=<optimized out>, sip=<optimized out>, signo=11) at ../../../../os/osinit.c:156
```

Xorg catches the segfault, logs `Caught signal %d (%s). Server aborting`, and calls
`FatalError → AbortServer → OsAbort → abort()`. The core therefore captures the *abort*, not the
original fault; `rip` sits in `__pthread_kill`. Anyone reading only `Signal: 6` will chase the
wrong thing.

### Full symbolised backtrace

```
#0  __pthread_kill_implementation (no_tid=0, signo=6, ...) at ./nptl/pthread_kill.c:44
#3  __GI_raise (sig=6) at ../sysdeps/posix/raise.c:26
#4  __GI_abort () at ./stdlib/abort.c:79
#5  OsAbort () at ../../../../os/utils.c:1361
#6  AbortServer () at ../../../../os/log.c:879
#7  FatalError (f=0x... "Caught signal %d (%s). Server aborting\n") at ../../../../os/log.c:1017
#8  OsSigHandler (unused=..., sip=..., signo=11) at ../../../../os/osinit.c:156
#9  OsSigHandler (signo=11, sip=..., unused=...) at ../../../../os/osinit.c:110
#10 <signal handler called>
#11 RRTellChanged (pScreen=<optimized out>) at ../../../../randr/randr.c:654               ← FAULT
#12 xf86platformRemoveDevice (index=0) at ../../../../../../hw/xfree86/common/xf86platformBus.c:738
#13 DeleteGPUDeviceRequest (attribs=0x5e7954b3b590) at ../../../../../../../hw/xfree86/os-support/linux/lnx_platform.c:214
#14 device_removed (device=0x5e7954d14540) at ../../../../config/udev.c:336
#15 socket_handler (fd=..., ready=..., data=...) at ../../../../config/udev.c:374
#16 ospoll_wait (ospoll=0x5e7953582a00, timeout=...) at ../../../../os/ospoll.c:657
#17 WaitForSomething (are_ready=1) at ../../../../os/WaitFor.c:208
#18 Dispatch () at ../../../../dix/dispatch.c:492
#19 dix_main (argc=15, ...) at ../../../../dix/main.c:274
#22 _start ()
```

### The crash is deterministic

The unsymbolised backtrace is **byte-for-byte identical** across every captured occurrence — same
symbols, same offsets in every frame, only ASLR bases differing. Compared across 2026-05-11,
2026-05-31 and 2026-09-05. Not a race.

### Why the second login always works

By the time the greeter is retried, DRM enumeration has settled, no further GPU remove events are
generated, and the faulting path is never entered.

---

## Troubleshooting steps taken

1. **Read the surfaced error at face value** — `Unrecoverable failure in required component
   org.gnome.Shell.desktop` suggested a GNOME Shell bug. Ruled out by the preceding
   `Unable to open display ':0'`, proving the display server died first.

2. **Searched `/var/crash`** — found `_usr_lib_xorg_Xorg.120.crash` (11 MB, owner `gdm`),
   timestamped to the boot in question. Confirmed Xorg was the crashing process.

3. **Counted occurrences across retained boots** — present in boots -7, -5 and 0; absent from
   -6, -4, -3, -2, -1.

4. **Correlated against NVIDIA driver presence:**

   | boot | kernel | nvidia loaded at boot | greeter crash |
   |------|--------|-----------------------|---------------|
   | -7   | 6.17.0-14 | yes                | **yes** |
   | -6   | 6.17.0-14 | yes                | no |
   | -5   | 6.17.0-14 | yes                | **yes** |
   | -4   | 6.17.0-35 | no                 | no |
   | -3   | 6.17.0-35 | no                 | no |
   | -2   | 7.0.0-28  | no                 | no |
   | -1   | 7.0.0-28  | loaded mid-session | no |
   | 0    | 7.0.0-31  | yes                | **yes** |

   Consistent with the root cause: without the NVIDIA driver there is no GPU screen to remove, so
   the faulting path cannot be entered. Boot -1 is a useful control — the driver loaded *after* the
   greeter ran. Boot -6 is the lone counter-example among NVIDIA-loaded boots. Treat as supporting
   evidence only; the sample is 8 boots and driver presence is confounded with kernel version.

5. **Extracted the unsymbolised backtrace from the journal** — established the shape of the call
   chain and that `RRTellChanged` was the faulting frame, before any symbols were available.

6. **Enabled debug symbols and retraced** — `ddebs.ubuntu.com` was not configured and no `dbgsym`
   packages were installed, so `apport-retrace` would have returned the same nearest-symbol output.
   Added the ddebs source, installed `xserver-xorg-core-dbgsym`, unpacked the report with
   `apport-unpack`, and ran `gdb` against the core.

7. **Validated the symbolisation despite a version skew** — see caveat below. The crashing 1.5
   binary's own backtrace names address `0x5e7913518f12` as `RRTellChanged+0x2a2`; gdb using 1.6
   symbols independently resolves the same address to `RRTellChanged` at `randr.c:654`. Two
   independent symbol sources agreeing on one address confirms the layout is identical for this
   function.

8. **Inspected frame locals** — found the garbage `iter->myNum` / `iter->isGPU` and the
   `main_arena+528` free-list pointers in `*pSecondaryScrPriv`, establishing use-after-free rather
   than a null dereference.

---

## Caveat on the analysis environment

Installing `xserver-xorg-core-dbgsym` **upgraded `xserver-xorg-core` from `2:21.1.12-1ubuntu1.5`
to `2:21.1.12-1ubuntu1.6`**, because the dbgsym package depends on an exact version and only
`1ubuntu1.6` is carried in the configured ddebs suites. Also upgraded: `xserver-common`,
`xserver-xorg-legacy`, `xserver-xephyr`.

Consequences:

- The symbols used are from a different build than the dump. Validated as sound by step 7 above,
  and corroborated by apport's own crash-time `StacktraceTop`, which already read `RRTellChanged`.
- The machine now runs a newer X server than the one that crashed. Whether `1ubuntu1.6` still
  reproduces is **untested** — worth watching over the next several boots.
- To retrace against the exact original build, `2:21.1.12-1ubuntu1.5` is available from
  `noble-security`, but its matching dbgsym requires adding a `noble-security` ddebs source.

---

## Fix

**No fix applied.** The defect is in the packaged `xorg-server`, not local configuration.

### Candidate 1 — report upstream

The analysis is now specific enough to be actionable. Report against `xorg-server` (freedesktop
GitLab) or Ubuntu's `xorg-server` package:

> `xf86platformRemoveDevice()` (`hw/xfree86/common/xf86platformBus.c:738`) calls `RRTellChanged()`
> on the primary screen after the GPU screen has been closed and its `rrScrPriv` freed, while that
> screen is still linked into `primary->secondary_list`. `RRTellChanged()` (`randr/randr.c:654`)
> walks the list and dereferences the freed private. Reproduces deterministically at GDM greeter
> teardown on hybrid AMD primary + NVIDIA GPU-screen systems.

Attach the symbolised backtrace and the frame-11 locals above.

### Candidate 2 — run the GDM greeter on Wayland

The crash is confined to the greeter's Xorg instance; the user session can stay X11. Ubuntu forces
the greeter to Xorg because a vendor NVIDIA driver ≥510 is present:

```
/usr/lib/udev/rules.d/61-gdm.rules:79
  ATTR{version}=="[5-9][1-9][0-9].*", GOTO="gdm_prefer_xorg"
```

Overriding means shadowing that rule from `/etc/udev/rules.d/`. **Test from a TTY with a way
back** — the same file also governs whether Wayland is disabled outright, and a mistake can leave
no working greeter.

### Candidate 3 — accept the behaviour

Self-recovering, costs one extra login per boot. Given Candidate 2 risks leaving the machine
without a working greeter, deliberately doing nothing remains legitimate — and is what has been in
effect for months.

### Not a fix — reinstalling or downgrading the NVIDIA driver

The crash predates the current driver and reproduces across `6.17.0-14` and `7.0.0-31` kernels with
two NVIDIA package versions. The bug is in the X server; NVIDIA merely supplies the GPU screen
whose removal triggers it.

---

## Files changed

- None. Root cause identified; no remediation applied.
### Retained evidence

- `evidence/2026_09_05_xorg_greeter_crash.symbolised.txt` — the symbolised backtrace and frame
  locals, i.e. every finding in this document in its raw form. Readable without gdb, without
  matching dbgsym packages, and without the version-skew caveat above ever mattering again.

**The raw core dump is deliberately not retained in this repo.** A core dump is a snapshot of
process memory; this one is the GDM greeter's X server and can contain window contents, input
buffers and session tokens. That is not something to commit to a monorepo or attach to a public
bug tracker. The symbolised text carries the analysis and no raw memory.

The original remains at `/var/crash/_usr_lib_xorg_Xorg.120.crash` until `whoopsie` clears it — the
only window in which the dump can be re-examined or attached to a *private* Ubuntu bug report. To
re-open it while it lasts:

```bash
apport-unpack /var/crash/_usr_lib_xorg_Xorg.120.crash /tmp/xorg-unpacked
gdb -batch -nx -iex "set debuginfod enabled off" \
    /usr/lib/xorg/Xorg /tmp/xorg-unpacked/CoreDump -ex bt
```

Note this requires `xserver-xorg-core-dbgsym` and the `ddebs.ubuntu.com` source; see the caveat
section for the version-skew trap that entails.

- Analysis side effect: `xserver-xorg-core`, `xserver-common`, `xserver-xorg-legacy`,
  `xserver-xephyr` upgraded `1ubuntu1.5` → `1ubuntu1.6`; `xserver-xorg-core-dbgsym` and
  `ubuntu-dbgsym-keyring` installed; `/etc/apt/sources.list.d/ddebs.list` added.
