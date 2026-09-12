#!/usr/bin/env bash
# Start video-trimmer. Args are passed through to server.py (--src, --out, --port).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8791}"

if ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
  echo "port ${PORT} already in use — run ./kill.sh first" >&2
  exit 1
fi

exec python3 "${HERE}/server.py" --port "${PORT}" "$@"
