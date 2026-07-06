---
title: Go TUI CLI: Bubble Tea stack and ldflags versioning
date: 2026-05-31
tags: go, tui, bubbletea, cli, github-actions
---

Standard stack: github.com/charmbracelet/bubbletea + bubbles/textinput + lipgloss. For embedded version strings via ldflags, the path follows the module name in go.mod: -X <module>/internal/version.AppVersion=${VERSION}. Store version in internal/version/version.go with a single var AppVersion = "v0.1.0". CI reads it with grep -oP and bumps with sed. GitHub Contents API (https://api.github.com/repos/{owner}/{repo}/contents/) lists files at 60 req/hr unauthenticated; raw content from https://raw.githubusercontent.com/{owner}/{repo}/main/{file}.
