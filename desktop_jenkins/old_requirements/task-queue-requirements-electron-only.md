# Task Queue Manager - Electron-Only Requirements Specification

## Overview

A desktop task queue manager with a shared React frontend and a single Electron/Node.js backend. The application manages file processing tasks through manual queuing and automated workflow triggers.

## Technology Stack

- **Frontend**: React with TypeScript (shared)
- **Backend**: Electron with Node.js (single supported backend)
- **Database**: SQLite (`better-sqlite3`)
- **File Watching**: `chokidar`

## Architecture

The application uses a shared frontend and a well-defined IPC bridge to the Electron backend. All references to alternate backends have been removed to simplify development and focus tooling on the Electron stack.

### Project Structure (focused)

```
task-queue-manager/
├── packages/
│   ├── frontend/                    # Shared React app
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   ├── pages/
│   │   │   └── api/
│   │   │       ├── bridge.ts        # Abstract backend interface (Electron-only)
│   │   │       └── electron-bridge.ts # Electron implementation
│   │   ├── index.html
│   │   └── package.json
│   
│   └── backend-electron/            # Electron/Node.js backend
│       ├── src/
│       │   ├── main.ts              # Main process entry
│       │   ├── preload.ts           # Preload script
│       │   ├── handlers/            # IPC handlers
│       │   │   ├── index.ts
│       │   │   ├── queue.ts
│       │   │   ├── task.ts
│       │   │   ├── workflow.ts
│       │   │   └── download.ts
│       │   ├── executors/           # Task executors
│       │   │   ├── index.ts
│       │   │   ├── copy.ts
│       │   │   ├── transcode.ts
│       │   │   ├── archive.ts
│       │   │   └── download.ts
│       │   ├── db/                  # Database layer
│       │   │   ├── index.ts
│       │   │   ├── migrations.ts
│       │   │   └── models.ts
│       │   ├── watcher/             # File watching
│       │   └── events.ts            # Event emission
│       ├── package.json
│       └── electron-builder.json
├── shared/                          # Shared types & constants
│   ├── types.ts                     # TypeScript interfaces
│   ├── constants.ts                 # Shared constants
│   └── package.json
├── package.json                     # Workspace root
└── README.md
```

## Backend Bridge Interface

The frontend communicates with the Electron backend through a unified interface defined in `bridge.ts` and implemented in `electron-bridge.ts`.

Key points:
- Keep `bridge.ts` as the single source of backend API types and method signatures.
- Implement runtime bridge selection to always return the `ElectronBridge` in development/builds for this repository.

## Electron Implementation Notes

### Preload Script

Use a secure, minimal `preload.ts` exposing an `electronAPI` with a whitelisted set of channels for `invoke` and `on`.

Whitelist example includes channels such as:
- `create-queue`, `get-queues`, `get-queue`, `update-queue`, `delete-queue`
- `create-task`, `get-tasks`, `update-task`, `delete-task`
- `select-directory`, `select-files`, `select-file`

### Main Process

`main.ts` should:
- Initialize the Electron app and create the `BrowserWindow`.
- Initialize the database via `initDatabase()`.
- Register IPC handlers using `ipcMain.handle` for the channel list in the preload whitelist.
- Export a utility like `emitToRenderer(channel, data)` for sending events to the renderer when needed.

## Process Management

Provide a platform-aware process manager targeting Node.js child processes:
- Unix (Linux/macOS): use `SIGTERM` then `SIGKILL` for force.
- Windows: use `taskkill /PID {pid}` or `taskkill /PID {pid} /F` for force.

## Queue & Task Models

Database schema and TypeScript models remain identical to the previous schema but are implemented through `better-sqlite3`.

### Database Location

`{app_data}/task-queue-manager/data.db`

### Core Tables

-- Queues, Tasks, Workflows, Workflow Tasks, Workflow Files, Workflow File Tasks, Processed Files, Task Templates, User Contexts, Header Presets

All schema definitions and migrations should be maintained in `packages/backend-electron/src/db/migrations.ts`.

## File Watching

Use `chokidar` with stabilization logic:
1. Debounce events (e.g., 500ms)
2. Check file lock/handle availability
3. Verify size stability over 2-3s
4. Then enqueue for processing

Persist processed file records in SQLite to avoid reprocessing.

## Download Task

Download features are implemented in Node.js using native HTTP libraries or `node-fetch`/`axios` as needed. Support:
- Single/multi URL inputs, resume via Range headers, concurrent limits, retry logic, redirects, rate limiting.

## Dependency Management

Check for required binaries at startup and show platform-specific install instructions if missing. Optional dependencies (like `pigz`) should fall back gracefully.

## Startup Sequence

1. Initialize `better-sqlite3` database
2. Check external dependencies
3. Load app settings
4. Load built-in user contexts from JSON
5. Resume watchers/queues depending on `pauseAllOnStartup` setting

## Development Notes

- Remove any build scripts, CI steps, or docs that referenced `backend-tauri` or Rust tooling.
- Ensure `packages/frontend/src/api/bridge.ts` selects `ElectronBridge` by default.
- Update `pnpm-workspace.yaml` / workspace config if previously enumerated `packages/backend-tauri`.

## When to use Electron (single backend decision)

- Use Electron because development and rendering consistency are prioritized across platforms.
- This repo will focus on Electron to simplify contributor requirements and CI setup.

---

This document intentionally removes Tauri/Rust-specific sections and provides concise guidance to continue development with Electron only. For any parts of the original spec you want preserved or reintroduced, let me know which sections and I will merge them back in adjusted for the Electron-only stack.
