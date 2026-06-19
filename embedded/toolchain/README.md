# embedded/toolchain

Shared, version-pinned Arduino build toolchain for every project under `embedded/`.

**What's tracked:** `setup.sh` + `manifest.txt` (the recipe). **What's not:** the
`arduino-cli` binary and `~/.arduino15` cores/libraries — those are installed by the
script, never committed (keeps the repo small and portable across machines/OSes).

## Bootstrap

```bash
embedded/toolchain/setup.sh
```

Installs `arduino-cli` to `~/.local/bin` if missing, adds the board-manager URLs, and
installs the **pinned** cores + libraries from `manifest.txt`. Idempotent — re-run any time.

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
