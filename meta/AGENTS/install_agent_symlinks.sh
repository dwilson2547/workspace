#!/usr/bin/env bash
# Links every agent definition in this folder into ~/.claude/agents, the way
# meta/SKILLS/install_skill_symlinks.sh does for skills. Idempotent: re-run after
# adding, renaming or removing an agent.
#
# Why user-level and not the workspace's .claude/agents: Claude Code looks for
# project agents by walking up from the working directory only as far as the
# repository root, and a submodule is its own repository. A session started in
# robotics/robo-services could not see .claude/agents at the workspace root
# (tested 2026-11-25: "--agent 'zero-trust' not found").

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${HOME}/.claude/agents"
DRY_RUN=false

usage() {
  cat <<'EOF'
Usage: ./install_agent_symlinks.sh [--dry-run]

Creates a symlink in ~/.claude/agents for each top-level *.md in this folder whose
frontmatter has a name: line. README.md and archive/ are not agents.
Links into this folder whose agent no longer exists are removed.
EOF
}

log() { printf '%s\n' "$*"; }

link_path() {
  local target="$1" dest="$2"
  if [[ -L "$dest" && "$(readlink "$dest")" == "$target" ]]; then
    log "ok       $dest"
    return
  fi
  if [[ -e "$dest" && ! -L "$dest" ]]; then
    log "skipping $dest (exists and is not a symlink)"
    return
  fi
  if [[ "$DRY_RUN" == true ]]; then
    log "would link $dest -> $target"
    return
  fi
  rm -f "$dest"
  ln -s "$target" "$dest"
  log "linked   $dest -> $target"
}

main() {
  case "${1:-}" in
    -h|--help) usage; exit 0 ;;
    --dry-run) DRY_RUN=true ;;
    "") ;;
    *) usage >&2; exit 1 ;;
  esac

  mkdir -p "$CLAUDE_DIR"

  local f
  for f in "$SCRIPT_DIR"/*.md; do
    [[ -f "$f" ]] || continue
    [[ "$(basename "$f")" == README.md ]] && continue
    # An agent file opens with frontmatter that names it.
    if ! awk 'NR==1 && $0!="---" {exit 1} NR>1 && /^---$/ {exit found?0:1} NR>1 && /^name:/ {found=1} END {exit found?0:1}' "$f"; then
      log "skipping $(basename "$f") (no name: in frontmatter)"
      continue
    fi
    link_path "$f" "$CLAUDE_DIR/$(basename "$f")"
  done

  # Drop links into this folder whose target has gone (a renamed or removed agent).
  local l
  for l in "$CLAUDE_DIR"/*.md; do
    [[ -L "$l" ]] || continue
    case "$(readlink "$l")" in
      "$SCRIPT_DIR"/*|*/.claude/agents/*)
        if [[ ! -e "$l" ]]; then
          if [[ "$DRY_RUN" == true ]]; then log "would remove dangling $l"; else rm -f "$l"; log "removed  dangling $l"; fi
        fi ;;
    esac
  done
}

main "$@"
