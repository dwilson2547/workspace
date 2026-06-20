# embedded/toolchain

Shared, version-pinned build toolchains for every project under `embedded/` — the
**firmware** side (`arduino-cli` + cores/libraries) and the **hardware/PCB** side (KiCad EDA).

**What's tracked:** the recipes (`setup.sh` + `manifest.txt` for firmware, `setup-kicad.sh`
for KiCad). **What's not:** the binaries — `arduino-cli`, `~/.arduino15` cores/libraries,
and the ~478 MB KiCad AppImage. Those are installed by the scripts, never committed (keeps
the repo small and portable across machines/OSes).

## Bootstrap

```bash
embedded/toolchain/setup.sh         # firmware: arduino-cli + pinned cores/libs
embedded/toolchain/setup-kicad.sh   # hardware: pinned KiCad (kicad-cli + GUI)
```

`setup.sh` installs `arduino-cli` to `~/.local/bin` if missing, adds the board-manager
URLs, and installs the **pinned** cores + libraries from `manifest.txt`. Idempotent — re-run
any time.

## KiCad (hardware / PCB)

`setup-kicad.sh` pins **KiCad 10.0.3** and reproduces the install: it places the AppImage in
`~/.local/opt` and drops thin `kicad` / `kicad-cli` wrappers in `~/.local/bin` (the AppImage
is a multicall binary keyed on its first argument, so name-based symlinks misdispatch — hence
wrappers). The AppImage isn't committed; download `kicad-10.0.3-x86_64.AppImage` (or its
`.tar`) from <https://www.kicad.org/download/linux/> into `~/Downloads` and run the script,
or point it at a file with `KICAD_SRC=/path/to/file`. Bump `KICAD_VERSION` in the script to
upgrade.

Headless usage (CI, exports, design rule checks) goes through `kicad-cli`:

```bash
kicad-cli version
kicad-cli sch export pdf  embedded/<project>/hardware/<board>.kicad_sch -o board.pdf
kicad-cli pcb export gerbers embedded/<project>/hardware/<board>.kicad_pcb -o gerbers/
kicad-cli pcb export svg     embedded/<project>/hardware/<board>.kicad_pcb -o board.svg
kicad-cli pcb drc            embedded/<project>/hardware/<board>.kicad_pcb   # design rule check
```

`kicad` (no `-cli`) launches the GUI or any other bundled tool (`kicad pcbnew`, etc.).

## Changing a pinned version

Edit the version in `manifest.txt`, re-run `setup.sh`, commit. That's the whole workflow;
the manifest is the single source of truth for what every embedded build links against.

## Building a project

`arduino-cli` is on PATH after bootstrap. From the workspace root:

```bash
arduino-cli compile --fqbn adafruit:samd:adafruit_matrixportal_m4 embedded/<project>/firmware/<sketch>
arduino-cli upload -p /dev/ttyACM0 --fqbn adafruit:samd:adafruit_matrixportal_m4 embedded/<project>/firmware/<sketch>
```

(Matrix Portal **M4** = `adafruit:samd:adafruit_matrixportal_m4`. The ESP32-S3 MatrixPortal
is a different FQBN under the `esp32` core.)

For the classic **ESP32 dev boards** (ESP32-D0WD-V3 WROOM-32 — both the Inland and Chinese
units), the board is `esp32:esp32:esp32` (ESP32 Dev Module) on `/dev/ttyUSB0`:

```bash
arduino-cli compile --fqbn esp32:esp32:esp32 embedded/<project>/firmware/<sketch>
arduino-cli upload -p /dev/ttyUSB0 --fqbn esp32:esp32:esp32 embedded/<project>/firmware/<sketch>
```

## Notes

- The `esp32` core is now pinned in `manifest.txt` (`esp32:esp32`) alongside its
  board-manager URL, so `setup.sh` reproduces ESP32 builds on a fresh machine. Bump the
  version there the same way as any other pin.
- **PlatformIO:** for projects that prefer `pio`, reproducibility lives in each project's
  `platformio.ini` instead — that's the per-project equivalent of this manifest. We'll add
  shared `pio` conventions here if/when a project needs it.
