#!/usr/bin/env bash
# Compiles and runs the pure-logic tests on the host. No board required.
set -euo pipefail
cd "$(dirname "$0")/.."
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
g++ -std=c++17 -Wall -Wextra -Iinclude \
    test/test_geometry.cpp src/geometry.cpp \
    -o "$out/test_geometry"
"$out/test_geometry"
