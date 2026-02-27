# Media Manager

A cross-platform desktop media management application (Windows + Linux) for importing, browsing, and organizing large photo/video libraries (tested intent: 500k+ items).

## Key Features

- Import photos and videos by file or folder (recursive scan)
- EXIF metadata extraction and browsing
- Offline face detection with auto-clustering (InsightFace + HDBSCAN)
- User-correctable face assignments with versioned clustering runs
- Automatic image/video captioning via BLIP-2 (Salesforce)
- Task queue architecture for progressive background processing
- Infinite scroll with DOM virtualization (TanStack Virtual)
- Multiple independent libraries, each with isolated metadata

## Architecture

- **Frontend:** Electron + React + TypeScript (electron-vite)
- **Backend:** Python 3.13 + FastAPI, spawned as subprocess by Electron on port 7899
- **Database:** SQLite (global `settings.db` + per-library `library.db`)
- **Task queue:** Custom asyncio loop + ProcessPoolExecutor, backed by SQLite
- **ML models:** Downloaded once to `{data_root}/models/` from HuggingFace Hub

## Project Structure

```
media-app-3/
├── electron/
│   └── main/
│       ├── index.ts        # Electron main process
│       └── python.ts       # Python subprocess management
├── src/                    # React renderer
├── backend/
│   ├── main.py             # FastAPI app entry
│   ├── api/                # Route handlers
│   ├── db/                 # SQLAlchemy models
│   ├── tasks/              # Task queue + ML workers
│   └── tests/              # pytest tests
└── docs/plans/             # Design and implementation docs
```

## Setup

### Prerequisites

- Node.js 18+
- Python 3.13
- npm

### Frontend

```bash
npm install
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Development

```bash
# From project root — starts Electron (which spawns Python automatically)
npm run dev
```

### Run Backend Tests

```bash
cd backend
source .venv/bin/activate
pytest -v -m "not slow"
```

The `not slow` marker excludes the BLIP-2 captioning test which requires the ~5.5 GB model download. To run everything including slow tests, omit the `-m` flag.

## Documentation

| Document | Description |
|---|---|
| `docs/plans/2026-02-19-media-management-design.md` | Full architecture design doc |
| `docs/plans/2026-02-19-media-management-implementation.md` | Step-by-step implementation plan (34 tasks) |
| `docs/plans/PROGRESS.md` | Current implementation progress |

## Data Layout (Runtime)

```
{global_root}/                    # Set in app settings on first run
├── settings.db                   # Global settings + library registry
├── models/                       # Shared AI models (downloaded once)
│   ├── insightface/
│   └── blip2/
└── {library_name}/
    ├── library.db                # Per-library database
    ├── thumbnails/               # Pre-generated thumbnails
    ├── face_crops/               # Extracted face images
    └── clustering_runs/          # Saved clustering experiments (max 10)
```
