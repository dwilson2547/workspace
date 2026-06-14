# Desktop Task Manager (Phase 1)

Electron + React + TypeScript desktop app scaffolding with a SQLite-backed queue/task system.

## Phase 1 Scope

- Electron main process with IPC bridge
- React renderer with queue list and task view
- SQLite database layer using better-sqlite3
- Queue CRUD and sequential execution
- Basic task types: copy, move, delete

## Getting Started

1. Install dependencies
2. Run dev mode
3. Create a queue and add tasks

## Scripts

- `npm run dev`: Run Electron + Vite in watch mode
- `npm run build`: Build renderer and main process
- `npm run start`: Run Electron using built main process
