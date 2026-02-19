# Media Manager — Claude Context

This is a cross-platform desktop media management application (Windows + Linux).

## This Project's Root

`/home/daniel/documents/workspace/media-apps/media-app-3`

Do not search parent directories or sibling projects for context. All relevant code is under this directory.

## Architecture

- **Electron** shell (`electron/main/`) spawns a **Python FastAPI** backend on startup (port 7899)
- **React + TypeScript** frontend (`src/`) built with electron-vite
- **Python 3.11 + FastAPI** backend (`backend/`) handles all data and ML work
- **SQLite** databases: one global `settings.db`, one `library.db` per library
- **Task queue**: asyncio loop in Python dispatches ML jobs to a ProcessPoolExecutor

## Key Commands

### Frontend (from project root)
```bash
npm run dev          # Start Electron + React dev server
npm run typecheck    # TypeScript type check (no emit)
npm run build        # Production build
```

### Backend (from backend/ with venv active)
```bash
source .venv/bin/activate           # Activate venv (Linux)
# or: .venv\Scripts\activate        # Windows

pytest -v                           # Run all tests
pytest tests/test_foo.py -v         # Run specific test file
uvicorn main:app --port 7899 --reload  # Run backend standalone
```

## Directory Structure

```
media-app-3/
├── electron/
│   ├── main/
│   │   ├── index.ts        # Electron main process (window creation, lifecycle)
│   │   └── python.ts       # Spawns/kills Python subprocess
│   └── preload/
│       └── index.ts        # Context bridge (exposes IPC to renderer)
├── src/                    # React renderer process
│   ├── main.tsx            # React entry point
│   ├── App.tsx             # Root component
│   └── env.d.ts            # Vite env type reference
├── backend/
│   ├── main.py             # FastAPI app, lifespan, router registration
│   ├── api/                # FastAPI route handlers (one file per domain)
│   ├── db/                 # SQLAlchemy models and DB init helpers
│   ├── tasks/              # Task queue engine and ML worker functions
│   ├── tests/              # pytest tests (mirror structure of backend/)
│   ├── requirements.txt    # Python dependencies
│   └── pytest.ini          # asyncio_mode = auto, testpaths = tests
├── docs/plans/
│   ├── 2026-02-19-media-management-design.md       # Architecture decisions
│   ├── 2026-02-19-media-management-implementation.md  # 34-task implementation plan
│   └── PROGRESS.md         # Current phase status and stopping point
├── electron.vite.config.ts # electron-vite build config
├── tsconfig.json           # Root (references node + web)
├── tsconfig.node.json      # Main process TS config
└── tsconfig.web.json       # Renderer TS config
```

## Python Backend Conventions

- **One router per domain** in `backend/api/` — imported and registered in `main.py`
- **DB sessions** yielded from generator functions (`get_global_db`, `get_library_session`)
- **All tests** use the shared `async client` fixture from `backend/tests/conftest.py`
- **No `@pytest.mark.asyncio`** needed — `asyncio_mode = auto` is set in `pytest.ini`
- **Task workers** receive `(task_id, task_type, media_item_id, library_name, data_root)` and write results directly to the DB
- **Python venv** lives at `backend/.venv/` — always activate before running Python commands

## Frontend Conventions

- **Package manager:** npm (not yarn, not pnpm)
- **Port 7899** — all API calls go to `http://127.0.0.1:7899`
- `contextIsolation: true`, `sandbox: true` — no Node.js in renderer; use IPC via preload
- React deps (`react`, `react-dom`) are in `dependencies`, not `devDependencies`

## Implementation Plan

The full 34-task plan is at `docs/plans/2026-02-19-media-management-implementation.md`.
Current progress is tracked in `docs/plans/PROGRESS.md`.

When implementing tasks from the plan:
1. Read the task text from the plan file (it contains exact file paths and code)
2. Follow TDD: write failing test → implement → verify pass → commit
3. Use subagent-driven development with spec + quality review after each task
4. Pause between phases and confirm with user before continuing

## ML Libraries (added in later phases)

- **InsightFace** (`buffalo_l` model, ~500MB) — face detection and ArcFace embeddings
- **HDBSCAN** — density-based face clustering
- **FAISS** (`faiss-cpu`) — nearest-neighbor similarity search
- **BLIP-2** (`Salesforce/blip2-opt-2.7b`, ~5.5GB) — image/video captioning
- **OpenCV** (`opencv-python-headless`) — video frame extraction
- Models download to `{data_root}/models/` on first use (offline after that)

## Database Notes

- `file_name` is **not unique** — multiple files with the same name from different directories are fully supported
- `file_path` is the primary identity for a media item
- Per-library DBs are initialized on demand via `init_library_db(data_root, library_name)`
- Global DB is initialized once at FastAPI startup via `init_global_db(data_root)`
