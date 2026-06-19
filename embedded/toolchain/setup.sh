#!/usr/bin/env bash
# Bootstrap the shared embedded Arduino toolchain from manifest.txt.
#
# Installs arduino-cli (to ~/.local/bin if absent) and the pinned cores + libraries.
# Idempotent: safe to re-run after editing manifest.txt to change a pin.
#
# The arduino-cli binary and its data dir (~/.arduino15, cores/libs) are NOT committed —
# only this script + manifest.txt are. Run this on any machine to reproduce the toolchain.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$HERE/manifest.txt"
BINDIR="${BINDIR:-$HOME/.local/bin}"

# 1. arduino-cli on PATH
if ! command -v arduino-cli >/dev/null 2>&1; then
  echo ">> arduino-cli not found; installing to $BINDIR"
  mkdir -p "$BINDIR"
  curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh \
    | BINDIR="$BINDIR" sh
  case ":$PATH:" in *":$BINDIR:"*) :;; *) echo "!! add $BINDIR to your PATH";; esac
fi
echo ">> using $(command -v arduino-cli)  [$(arduino-cli version | awk '{print $3}')]"

# 2. board-manager index URLs
while read -r u; do
  arduino-cli config add board_manager.additional_urls "$u" 2>/dev/null || true
done < <(awk '$1=="url"{print $2}' "$MANIFEST")
arduino-cli core update-index

# 3. cores (pinned)
while read -r c; do
  echo ">> core install $c"
  arduino-cli core install "$c"
done < <(awk '$1=="core"{print $2}' "$MANIFEST")

# 4. libraries (pinned; names may contain spaces, so take the rest of the line)
while read -r l; do
  [ -z "$l" ] && continue
  echo ">> lib install $l"
  arduino-cli lib install "$l"
done < <(sed -n 's/^lib[[:space:]]\+//p' "$MANIFEST")

echo ">> toolchain ready."
