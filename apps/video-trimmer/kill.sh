#!/usr/bin/env bash
# Stop any running video-trimmer.
set -euo pipefail
if pkill -f "[v]ideo-trimmer/server.py"; then
  echo "stopped"
else
  echo "not running"
fi
