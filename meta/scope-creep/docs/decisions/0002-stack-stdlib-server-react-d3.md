---
kind: decision
status: accepted
date: 2026-09-17T23:50:33-04:00
depends_on: [0001]
---

# 0002 — Stdlib Python server, React + d3 UI, laptop-standalone

## Options

- One Python process with `http.server`, serving a prebuilt static page. No framework, no
  daemon, nothing to deploy. Same shape as `doc-indexer`.
- FastAPI or Flask. Adds a venv and a dependency for three JSON routes.
- UI in React with d3 for zoom, hierarchy and scales, since the workspace's existing UI work is
  React. Alternatives were Svelte or plain canvas.

## Decision

Stdlib server; Vite + React + d3 for the UI, built once into `ui/dist`, which is gitignored. The
server works without the UI built and says how to build it.

## Consequences

- Node is a build-time dependency only. Runtime is Python 3.
- Local-first per the workspace rule for one-off tools: no cluster, no service.
