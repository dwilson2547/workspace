# Media Management Application — Design Document

**Date:** 2026-02-19
**Status:** Approved

---

## Overview

A cross-platform (Windows + Linux) desktop media management application for importing, browsing, and organizing large photo/video libraries. Core features: EXIF metadata collection, offline AI face detection with user-correctable clustering, automatic image/video captioning via BLIP-2, and a task queue architecture for progressive processing of imported media.

The application supports multiple independent libraries, each with its own database and metadata. All AI models run fully offline (downloaded once from HuggingFace Hub on first use).

---

## Technology Stack

### Desktop Shell
- **Electron** — app window, spawns/kills Python subprocess on start/exit, provides native OS file dialogs

### Frontend
- **React + TypeScript** via Vite
- **TanStack Virtual** — virtualized infinite scroll (handles 500k+ items without DOM bloat)
- **TanStack Query** — server state, caching, cursor-based pagination
- **React Router** — client-side routing
- **Package manager:** npm

### Backend
- **Python 3.11+** with **FastAPI + Uvicorn** (ASGI)
- Exposes a localhost HTTP API + WebSocket for real-time task progress
- Spawned as a subprocess by Electron; killed on app exit
- **Package manager:** pip + requirements.txt

### Database
- **SQLite** via SQLAlchemy (ORM) + Alembic (migrations)
- One global `settings.db` at the root data directory
- One `library.db` per library

### ML Libraries
| Library | Purpose |
|---|---|
| `insightface` (ONNX backend, `buffalo_l` model) | Face detection + ArcFace embedding generation |
| `hdbscan` | Density-based face clustering |
| `faiss-cpu` | Nearest-neighbor similarity search for incremental matching + corrections |
| `transformers` + `Salesforce/blip2-opt-2.7b` | Image/video captioning |
| `opencv-python` | Video frame extraction, video thumbnails |
| `Pillow` + `exifread` | EXIF extraction, image thumbnail generation |

Models are downloaded once to `{global_root}/models/` and shared across all libraries.

---

## Runtime Directory Layout

```
{global_root}/                        # User-configured in global settings
├── settings.db                       # Global settings + library registry
├── models/                           # Shared AI models (downloaded once)
│   ├── insightface/
│   └── blip2/
└── {library_name}/                   # One directory per library
    ├── library.db                    # Per-library SQLite database
    ├── thumbnails/                   # Pre-generated: {media_id}.jpg
    ├── face_crops/                   # Extracted face images: {face_id}.jpg
    └── clustering_runs/              # Up to 10 persisted runs
        ├── run_001/
        └── run_002/
```

Media files are **referenced in-place** — never copied. The file path is the reference. A future "Organize Library" feature will move files under a user-specified parent directory.

---

## Database Schema

### `settings.db` (global)

**`settings`** — key/value store for global configuration (root dir, default clustering params)
**`libraries`** — `id`, `name`, `created_at`, `last_accessed_at`

---

### `library.db` (per-library)

**`media_items`**
```
id, file_path, file_name, file_hash, media_type (image|video),
width, height, duration, captured_at, imported_at,
exif_data (JSON), blip_description, thumbnail_path, is_missing
```
`file_name` is not unique — multiple files with the same name from different directories are fully supported. Identity is `(file_path)` with `file_hash` for duplicate detection.

**`tasks`** — unified queue for per-media and library-wide jobs
```
id, task_type, status, priority, media_item_id (nullable, FK→media_items),
created_at, started_at, completed_at, error_message, retry_count
```
Task types: `thumbnail`, `exif`, `face_detection`, `blip`, `cluster_run`
Statuses: `pending`, `processing`, `completed`, `failed`

**`faces`**
```
id, media_item_id (FK→media_items), bounding_box (JSON),
embedding (BLOB — 512-dim float32), detection_confidence, crop_path
```

**`people`** — persistent named entities; survive across clustering runs
```
id, name (nullable), cover_face_id (FK→faces), created_at
```

**`clustering_runs`** — maximum 10 persisted; oldest non-active auto-deleted when 11th is created
```
id, run_number, created_at, parameters (JSON), notes,
is_active (bool), face_count, cluster_count
```

**`face_assignments`** — assignments are per-run; user corrections are preserved across runs
```
id, face_id (FK→faces), person_id (nullable FK→people — null = noise/unassigned),
clustering_run_id (FK→clustering_runs), confidence,
is_user_corrected (bool), corrected_at
```

---

## Task Queue Architecture

### Import flow
1. User selects files/folders via Electron native dialog
2. Backend recursively scans folders for supported extensions
3. `media_items` rows created; tasks enqueued in priority order:
   - `thumbnail` (priority 1 — needed for UI immediately)
   - `exif` (priority 2)
   - `face_detection` (priority 3)
   - `blip` (priority 4)

### Execution
A background asyncio loop polls the `tasks` table every second. It dispatches ready tasks to a `ProcessPoolExecutor` (bypasses GIL for ML workloads). Results are written back to the DB; progress events are broadcast over WebSocket.

**Concurrency:**
- `thumbnail` / `exif`: up to 4 concurrent workers
- `face_detection` / `blip`: 1–2 concurrent workers (memory-constrained)
- `cluster_run`: 1 at a time; no other clustering tasks may run concurrently

**Retry policy:** Failed tasks retry up to 3 times with exponential backoff. After 3 failures the task is marked `failed` and surfaced in the UI.

---

## ML Pipeline

### Face Detection
InsightFace `buffalo_l` detects faces, bounding boxes, and 512-dim ArcFace embeddings. Images are processed directly. Videos sample 1 frame per minute + first and last frame (light mode default; per-video re-processing at higher density is available on demand).

### BLIP-2 Captioning
`Salesforce/blip2-opt-2.7b` generates a caption per media item. Videos use the middle sampled frame. Caption stored in `media_items.blip_description`. Model kept warm in the worker process.

### Clustering (on demand)
1. Load all face embeddings into a numpy array
2. Run HDBSCAN with configurable `min_cluster_size`, `min_samples`, `cluster_selection_epsilon`
3. Match new clusters to existing named `people` via FAISS centroid similarity
4. Write assignments to `face_assignments` for the new run
5. Carry forward all `is_user_corrected = true` assignments from the previously active run
6. New run saved but **not** set active — user reviews and promotes it manually
7. If this is the 11th run, the oldest non-active run is deleted first

### Incremental Matching (new imports after active run exists)
1. Compute embedding for each new face
2. FAISS nearest-neighbor search against centroids of the active run's clusters
3. Above similarity threshold → assign tentatively (flagged as low confidence)
4. Below threshold → left unassigned, surfaced in UI as "unknown faces"

### User Corrections
Reassigning a face updates `face_assignments.is_user_corrected = true`. These corrections survive all future clustering runs and anchor FAISS matching for new imports.

---

## Frontend Architecture

### Routes
```
/setup                          Global settings (first-run wizard + settings)
/                               Library switcher / home
/library/:id                    Media grid (main view)
/library/:id/people             People browser
/library/:id/media/:id          Single media detail
```

### Media Grid
TanStack Virtual renders only visible DOM nodes plus a small buffer. Pages of 100 items fetched via cursor-based API as the user scrolls. Nodes outside the buffer are unmounted. Supports sorting by any EXIF field and filtering by person, date range, and media type.

### Import Panel
Slide-up panel with live task feed via WebSocket showing per-file status and overall counts. Import runs in the background and does not block browsing.

### People Browser
Grid of person cards (cover face crop + name or "Unknown #N"). Actions: rename, merge persons, move a face to a different person, mark as not-a-person. All corrections write immediately to the active run's `face_assignments`.

### Clustering Runs Panel (in global settings)
List of up to 10 runs: date, parameters, cluster count, face count. Actions per run: "Set as Active", "Delete", expandable diff vs. currently active run. "New Run" button exposes HDBSCAN parameter sliders + notes field before triggering the `cluster_run` task.

### Global Settings Page
- Base data directory (required on first launch)
- Default HDBSCAN clustering parameters
- Option to re-run clustering with updated parameters
- Model download status

---

## Key Constraints & Decisions

- **Filenames are not unique** — identity is based on `file_path`; `file_hash` used for duplicate detection
- **In-place file references** — no copying on import; broken links flagged via `is_missing`
- **Multiple libraries** — fully isolated DBs and metadata directories under a shared root
- **Offline AI** — all models downloaded once to `{global_root}/models/`, no internet required after initial setup
- **Infinite scroll safety** — TanStack Virtual + cursor pagination keeps DOM bounded regardless of library size
- **Clustering run limit** — maximum 10 runs persisted; oldest non-active auto-deleted at 11
- **Video processing** — light by default (1 frame/minute); per-video re-processing at higher density available on demand
