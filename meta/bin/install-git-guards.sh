#!/usr/bin/env bash
# Points the superrepo and every submodule at meta/bin/githooks via core.hooksPath,
# so the pre-commit guard applies everywhere. Idempotent — re-run after adding a
# submodule. See CONVENTIONS.md §9.
set -uo pipefail

WS="${WSGIT_ROOT:-/home/daniel/documents/workspace}"
HOOKS="$WS/meta/bin/githooks"
DRY=false
[ "${1:-}" = "--dry-run" ] && DRY=true

[ -x "$HOOKS/pre-commit" ] || { echo "error: $HOOKS/pre-commit missing or not executable" >&2; exit 1; }

set_one() {
  local repo="$1" label="$2" cur
  cur=$(git -C "$repo" config --local --get core.hooksPath 2>/dev/null || true)
  if [ "$cur" = "$HOOKS" ]; then echo "  ok       $label"; return; fi
  if $DRY; then echo "  would set $label"; return; fi
  git -C "$repo" config --local core.hooksPath "$HOOKS" && echo "  set      $label"
}

echo "hooks dir: $HOOKS"
set_one "$WS" "(superrepo)"

n=0
while read -r sm; do
  [ -n "$sm" ] || continue
  [ -e "$WS/$sm/.git" ] || { echo "  skip     $sm (not checked out)"; continue; }
  set_one "$WS/$sm" "$sm"
  n=$((n+1))
done < <(git -C "$WS" config --file "$WS/.gitmodules" --get-regexp '^submodule\..*\.path$' 2>/dev/null | awk '{print $2}' | sort)

echo "submodules processed: $n"
