#!/usr/bin/env bash
# Bootstrap the pinned KiCad EDA toolchain (kicad-cli + GUI) for embedded/ hardware work.
#
# KiCad ships as a self-contained AppImage. Like setup.sh, this tracks only the RECIPE:
# the pinned version + install steps. The ~478 MB AppImage itself is NOT committed — it
# lives in ~/.local/opt and is reproduced by re-running this script on any machine.
#
# The AppImage dispatches on its first argument (kicad-cli, kicad, etc.), so we install
# thin PATH wrappers rather than name-based symlinks (those misdispatch).
#
# Idempotent: safe to re-run. Bump KICAD_VERSION below to upgrade, then re-run + commit.
set -euo pipefail

KICAD_VERSION="10.0.3"
APPIMAGE="kicad-${KICAD_VERSION}-x86_64.AppImage"

OPTDIR="${OPTDIR:-$HOME/.local/opt}"
BINDIR="${BINDIR:-$HOME/.local/bin}"
DEST="$OPTDIR/$APPIMAGE"

mkdir -p "$OPTDIR" "$BINDIR"

# 1. Obtain the AppImage if we don't already have it.
#    KiCad's CDN wraps the AppImage in a .tar; we accept either form, downloaded by hand to
#    ~/Downloads (the official source page is https://www.kicad.org/download/linux/), or an
#    already-extracted .AppImage. Set KICAD_SRC to point elsewhere.
if [ ! -x "$DEST" ]; then
  SRC="${KICAD_SRC:-}"
  if [ -z "$SRC" ]; then
    for c in "$HOME/Downloads/$APPIMAGE" "$HOME/Downloads/$APPIMAGE.tar" "$DEST.tar"; do
      [ -f "$c" ] && SRC="$c" && break
    done
  fi
  if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
    echo "!! KiCad $KICAD_VERSION AppImage not found." >&2
    echo "   Download '$APPIMAGE' (or its .tar) from https://www.kicad.org/download/linux/" >&2
    echo "   into ~/Downloads, or set KICAD_SRC=/path/to/$APPIMAGE[.tar], then re-run." >&2
    exit 1
  fi
  case "$SRC" in
    *.tar) echo ">> extracting $SRC"; tar xf "$SRC" -C "$OPTDIR" ;;
    *)     echo ">> copying $SRC";    cp "$SRC" "$DEST" ;;
  esac
  chmod +x "$DEST"
fi

# 2. PATH wrappers. KiCad's AppImage is a multicall binary keyed on argv[1], so we forward
#    the tool name explicitly. `kicad` (GUI / any bundled tool) and `kicad-cli` (headless).
cat > "$BINDIR/kicad-cli" <<EOF
#!/bin/sh
exec "$DEST" kicad-cli "\$@"
EOF
cat > "$BINDIR/kicad" <<EOF
#!/bin/sh
exec "$DEST" "\$@"
EOF
chmod +x "$BINDIR/kicad-cli" "$BINDIR/kicad"

case ":$PATH:" in *":$BINDIR:"*) :;; *) echo "!! add $BINDIR to your PATH";; esac

# 3. Verify.
GOT="$("$BINDIR/kicad-cli" version 2>/dev/null || true)"
if [ "$GOT" = "$KICAD_VERSION" ]; then
  echo ">> kicad-cli ready  [$GOT]  via $DEST"
else
  echo "!! kicad-cli reports '$GOT', expected '$KICAD_VERSION'" >&2
  exit 1
fi
