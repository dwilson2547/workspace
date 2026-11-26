# AGENTS

Claude Code agent definitions for this workspace, the counterpart of `meta/SKILLS`. Each top-level
`*.md` here (except this README) is one agent: frontmatter with `name:` and `description:`, then
the agent's brief.

Install or refresh the links into `~/.claude/agents` with:

```bash
./meta/AGENTS/install_agent_symlinks.sh            # --dry-run to preview
```

Re-run after adding, renaming or removing an agent. Links are user-level, not the workspace's
`.claude/agents`, because a session started inside a submodule does not see the superrepo's
project agents (a submodule is its own repository root).

| Agent | Use | Start |
|---|---|---|
| `zero-trust` | Questions where a wrong answer is expensive; every claim verified, a hypothesis, or unknown | `claude --agent zero-trust` |
| `drones` | Work under `drones/`: builds, tuning, wiring, ArduPilot/Betaflight config | `claude --agent drones` |

Under `--agent`, the agent's brief is the session's system prompt (per the Claude Code docs; not
tested here); `CLAUDE.md` still loads. A brief should therefore carry what the session needs, not
assume Claude Code's default prompt is also present.
