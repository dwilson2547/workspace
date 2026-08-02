# Mission Planner on Linux (Ubuntu) — ground station install

Getting the ArduPilot ground station running on the Linux laptop, so the X500 (and anything else on
ArduPilot firmware) can be configured and flown without booting Windows. This is the "Linux laptop
thereafter" half of the [X500 config record](../../x500/web_bot_dump.md).

**Scope note:** ArduPilot itself is *firmware* that runs on the flight controller (Pixhawk), not on
the laptop. What installs on Linux is the **ground station** — here **Mission Planner**, a Windows
.NET app that runs on Linux under **Mono**. There is no native Linux build; Mono is the supported
path. (QGroundControl is the native-Linux alternative, but every param name, wizard, and motor-test
letter in the X500 doc is Mission Planner's, so MP is what we run.)

Related: [X500 config record](../../x500/web_bot_dump.md) · [ELRS index](elrs/README.md)

Set up **2026-07-25** on this laptop. Working end to end.

---

## 1. Target environment

| | |
|---|---|
| OS | Ubuntu 24.04.3 LTS (noble), x86_64 |
| Session | Wayland — MP is forced onto **XWayland**, see §4 |
| Mono | **6.8.0.105**, from the Ubuntu repos (`mono-complete`) |
| .NET | 8 + 10 present but **unused** — MP runs on Mono, not the .NET runtime |
| Install dir | `~/MissionPlanner/` |

Ubuntu's stock Mono 6.8 is a known-good version for Mission Planner. Do **not** chase a newer Mono
from the mono-project.com apt repo unless something forces it — newer Mono has historically been
*more* broken with MP's WinForms/GDI+ UI, not less.

---

## 2. Install Mono + GUI libraries

Needs sudo (one time):

```bash
sudo apt update
sudo apt install -y mono-complete
sudo apt install -y libgtk2.0-0 libgdiplus
```

- `mono-complete` — the full runtime. The minimal `mono-runtime` is missing assemblies MP loads at
  startup, so install the complete metapackage.
- `libgdiplus` — the GDI+ implementation MP's forms and the HUD draw through. Missing it is the
  classic "MP starts then dies rendering the HUD" failure.
- `libgtk2.0-0` — file dialogs and native widgets.

Verify:

```bash
mono --version        # expect: Mono JIT compiler version 6.8.0.x
```

---

## 3. Download + extract Mission Planner

Latest stable, straight from ArduPilot (~112 MB):

```bash
mkdir -p ~/MissionPlanner && cd ~/MissionPlanner
curl -L -o MissionPlanner-latest.zip \
  https://firmware.ardupilot.org/Tools/MissionPlanner/MissionPlanner-latest.zip
unzip -o -q MissionPlanner-latest.zip
ls MissionPlanner.exe        # should be present
```

The zip is the whole app (~400 MB extracted) — `MissionPlanner.exe`, its DLLs, and the `plugins/`
folder. No installer, no system files touched; it all lives under `~/MissionPlanner/`.

---

## 4. Launcher (forces XWayland)

MP + Mono renders reliably on **X11**, not native Wayland — on Wayland you get missing/garbled HUD
and misplaced dialogs. On a Wayland session, force the app through XWayland with `GDK_BACKEND=x11`.

`~/MissionPlanner/run.sh`:

```bash
#!/usr/bin/env bash
cd "$(dirname "$0")"
export GDK_BACKEND=x11
exec mono MissionPlanner.exe "$@"
```

```bash
chmod +x ~/MissionPlanner/run.sh
```

A healthy first launch logs plugin loads and `HUD 1 hz drawtime N gl True` — `gl True` means the
OpenGL HUD came up. It may open a "check for updates" dialog on first run; skip it (we update by
re-downloading the zip, §8).

### App-menu entry (optional)

`~/.local/share/applications/missionplanner.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=Mission Planner
Comment=ArduPilot Ground Control Station
Exec=/home/daniel/MissionPlanner/run.sh
Path=/home/daniel/MissionPlanner
Icon=/home/daniel/MissionPlanner/MissionPlanner.exe
Terminal=false
Categories=Utility;
```

Then `update-desktop-database ~/.local/share/applications`. "Mission Planner" now shows in the app
launcher.

---

## 5. Serial port access (connecting a flight controller over USB)

By default a normal user can't open `/dev/ttyACM*` / `/dev/ttyUSB*`, so MP shows **no COM port** for
a USB-connected Pixhawk. Add yourself to `dialout` once:

```bash
sudo usermod -aG dialout $USER
```

**Log out and back in** for the group to take effect (`groups` should then list `dialout`). A
Pixhawk enumerates as `/dev/ttyACM0`; a SiK USB radio or FTDI as `/dev/ttyUSB0`.

If a `brltty` grab steals the FTDI device (a known Ubuntu 24.04 annoyance — the port appears then
vanishes seconds after plug-in), remove it: `sudo apt remove brltty`.

---

## 6. Connecting

Top-right of MP: pick the port + baud, then **Connect**.

| Link | Port | Baud |
|---|---|---|
| Pixhawk over USB | `/dev/ttyACM0` | 115200 (or AUTO) |
| SiK 915 MHz telemetry | `/dev/ttyUSB0` | **57600** |

The SiK link is **57600, not 115200** — see [X500 §5](../../x500/web_bot_dump.md). Param download
over the radio takes 30–60 s; over USB it's a few seconds.

Full Parameter List lives under **Config → Full Parameter List** (set Config → Planner → Layout to
**Advanced** if the param pages are missing). There is no GUI page for UART assignment —
`SERIALx_PROTOCOL` is param-only.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Starts then exits while drawing the HUD | `libgdiplus` missing → §2 |
| `System.DllNotFoundException: libgdiplus` | same — install `libgdiplus` |
| Garbled / missing HUD, dialogs offscreen | native Wayland → use `run.sh` with `GDK_BACKEND=x11` (§4) |
| No COM port for a plugged-in FC | not in `dialout`, or didn't re-login (§5); or `brltty` grabbed it |
| Port appears then disappears | `brltty` → `sudo apt remove brltty` |
| Assembly / `TypeLoadException` at startup | installed `mono-runtime` not `mono-complete` (§2) |
| Missing param pages | Layout set to Basic → Config → Planner → Layout → Advanced |

Run `~/MissionPlanner/run.sh` from a terminal to watch the log live when diagnosing — the crash
reason is almost always in the last few lines.

---

## 8. Updating

MP has a built-in updater, but the clean path on Linux is to re-pull the zip over the same folder —
it preserves your config, which lives outside the app dir in `~/.config/`:

```bash
cd ~/MissionPlanner
curl -L -o MissionPlanner-latest.zip \
  https://firmware.ardupilot.org/Tools/MissionPlanner/MissionPlanner-latest.zip
unzip -o -q MissionPlanner-latest.zip
```

Your saved connection settings and param files aren't in `~/MissionPlanner/`, so re-extracting is
safe.

---

## 9. Optional — SITL / dev environment

To rehearse param changes and missions without hardware (referenced in
[X500 config management](../../x500/web_bot_dump.md)), ArduPilot's SITL runs the full flight stack in
software and connects to MP exactly like a real vehicle:

```bash
git clone --recurse-submodules https://github.com/ArduPilot/ardupilot.git
cd ardupilot
Tools/environment_install/install-prereqs-ubuntu.sh -y
. ~/.profile
sim_vehicle.py -v ArduCopter --console --map
```

SITL opens a MAVLink endpoint on TCP `127.0.0.1:5760`; connect MP to it via **TCP** instead of a
serial port. This is the dependency-heavy part of "ArduPilot on Linux" — the ground station (§1–§6)
needs none of it.

---

## Summary — reproduce on a fresh machine

```bash
# 1. runtime + libs
sudo apt update && sudo apt install -y mono-complete libgtk2.0-0 libgdiplus
# 2. app
mkdir -p ~/MissionPlanner && cd ~/MissionPlanner
curl -L -o MissionPlanner-latest.zip https://firmware.ardupilot.org/Tools/MissionPlanner/MissionPlanner-latest.zip
unzip -o -q MissionPlanner-latest.zip
# 3. launcher (Wayland-safe)
printf '#!/usr/bin/env bash\ncd "$(dirname "$0")"\nexport GDK_BACKEND=x11\nexec mono MissionPlanner.exe "$@"\n' > run.sh && chmod +x run.sh
# 4. serial access (log out/in after)
sudo usermod -aG dialout $USER
# run it
./run.sh
```
