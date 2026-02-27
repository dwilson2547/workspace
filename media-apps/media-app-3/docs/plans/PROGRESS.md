# Implementation Progress

**Plans:**
- `2026-02-19-media-management-implementation.md` — backend (all 34 tasks complete)
- `2026-02-21-ui-redesign-implementation.md` — frontend UI redesign (10/13 tasks complete)

**Last updated:** 2026-02-21 (session 4)

---

## Stopping Point

**UI REDESIGN COMPLETE — all 13 tasks done.**

Backend is fully complete (34/34 tasks, 66 tests passing). UI redesign is 13/13 tasks done. TypeScript clean (zero errors).

---

---

## UI Redesign Status (2026-02-21)

**Plan:** `2026-02-21-ui-redesign-implementation.md`
**Design doc:** `2026-02-21-ui-redesign-design.md`

| Task | Description | Status |
|---|---|---|
| 1 | Install Tailwind CSS v3 + Radix UI, configure PostCSS | ✅ Complete |
| 2 | Extend API client (importMedia, reassignFace, renamePerson, mergePeople) | ✅ Complete |
| 3 | Shared UI primitives: Button, Input, Badge, Spinner | ✅ Complete |
| 4 | AppShell sidebar layout component | ✅ Complete |
| 5 | Update App.tsx routing (layout route pattern) | ✅ Complete |
| 6 | Restyle Setup page | ✅ Complete |
| 7 | Update Home page (redirect + empty state) | ✅ Complete |
| 8 | Add Import to Library page (Radix dropdown, import files/folder) | ✅ Complete |
| 9 | Restyle MediaGrid (6 cols, sortBy/onEmpty props) + MediaCard | ✅ Complete |
| 10 | Redesign MediaDetail (two-column, % face boxes, reassign dropdown) | ✅ Complete |
| 11 | Redesign People browser (⋮ menu, inline rename, merge dialog) | ✅ Complete |
| 12 | Restyle Settings page | ✅ Complete |
| 13 | Restyle ImportProgress panel | ✅ Complete |

### Key decisions made during UI redesign
- **Tailwind v3** (not v4) — explicitly pinned to `tailwindcss@^3.4.17`
- **`fetchMediaPage` has no `sortBy` param** — backend doesn't support `sort_dir`; `sortBy` is only in the TanStack Query key for cache invalidation
- **`reassignFace`** sends `{ face_id, target_person_id }` (not `person_id`) — confirmed against backend
- **`mergePeople`** sends query params `source_id`/`target_id` (not JSON body) — confirmed against backend
- **Face overlays** use percentage-based CSS positioning (not SVG + ResizeObserver)
- **Sidebar width** is `w-[200px]` (explicit, not `w-48` which is 192px)
- **`imgSrc` in MediaDetail** uses `thumbnail_path ?? file_path` (not just `file_path`)
- **`ImportProgress`** offset uses `left-[200px]` to match sidebar width (update when restyling Task 13)

---

## Phase Status

| Phase | Tasks | Status | Notes |
|---|---|---|---|
| **Phase 1: Scaffolding** | 1–4 | ✅ Complete | |
| **Phase 2: Global Settings DB** | 5–7 | ✅ Complete | |
| **Phase 3: Per-Library DB** | 8 | ✅ Complete | |
| **Phase 4: Import + Task Queue** | 9–12 | ✅ Complete | |
| **Phase 5: Thumbnail Generation** | 13 | ✅ Complete | |
| **Phase 6: EXIF Extraction** | 14 | ✅ Complete | |
| **Phase 7: Media API + React Grid** | 15–18 | ✅ Complete | |
| **Phase 8: Face Detection** | 19–20 | ✅ Complete | InsightFace buffalo_l; onnxruntime==1.20.1 (Python 3.13 compat) |
| **Phase 9: BLIP-2 Captioning** | 21–22 | ✅ Complete | transformers==4.57.6, torch==2.10.0 (Python 3.13 compat); blip test is @slow |
| **Phase 10: Clustering System** | 23–25 | ✅ Complete | HDBSCAN clustering, 10-run limit, correction carry-forward, API |
| **Phase 11: People Browser** | 26–27 | ✅ Complete | People API + React browser with PersonCard; 52 backend tests |
| **Phase 12: Settings UI + Progress** | 28–29 | ✅ Complete | WebSocket progress panel + global settings page |
| **Phase 13: Media Detail View** | 30 | ✅ Complete | Full-res image, SVG face overlays, EXIF table, people chips; 54 backend tests |
| **Phase 14: Integration & Polish** | 31–34 | ✅ Complete | 66 backend tests |

---

## Phase 13 Detail (Completed)

### Task 30: Media detail page ✅
- `backend/api/media.py` — `GET /libraries/{name}/media/{id}/faces` endpoint added; SQLAlchemy 2.0 batch queries (two `.in_()` lookups instead of N+1); 404 guard for non-existent media_id; ORM serialization inside `try` block
- `backend/tests/test_media_api.py` — `test_get_media_faces_empty` (200 + `[]`) and `test_get_media_faces_nonexistent` (404) added; 54 backend tests total
- `src/pages/MediaDetail.tsx` — full-res image via `/thumbnail?path={file_path}`; SVG face overlays (absolutely positioned, fractional bounding boxes × rendered dimensions); callback ref + ResizeObserver for live resize tracking; BLIP description section; EXIF table (≤20 rows, skip null/empty values); people chips (unique dedup, navigate to `/library/:name?personId=`); back button; inline styles only
- `src/components/MediaGrid.tsx` — click handler navigates to `/library/:name/media/:id`
- `src/components/MediaCard.tsx` — `role="button"`, `tabIndex={0}`, `aria-label`, `onKeyDown` added
- `src/api/client.ts` — `fetchMediaItem`, `fetchMediaFaces`, `FaceWithPerson` interface added
- `src/api/types.ts` — `exif_data: Record<string, unknown> | null` added to `MediaItem`
- `src/App.tsx` — `/library/:name/media/:id` route added
- TypeScript: zero errors; 54 backend tests passing

---

## Phase 12 Detail (Completed)

### Task 28: Task progress panel ✅
- `src/hooks/useTaskProgress.ts` — WebSocket hook connecting to `ws://127.0.0.1:7899/ws/progress`; stores up to 100 events (newest first) with `seq` counter for stable React keys; persistent `counters` state (active/completed/failed) updated atomically; exponential-backoff reconnect (1s→30s cap) with `unmountedRef` guard; `onerror` sets disconnected; `typeof e.data !== 'string'` guard before JSON.parse
- `src/components/ImportProgress.tsx` — fixed-position slide-up panel (bottom of screen); connection status dot (green/grey); task counts from hook counters; last 20 events; collapsed by default; `max-height` CSS transition for slide animation; `role="button"`, `tabIndex={0}`, `aria-expanded`, `onKeyDown` on toggle; composite `key={ev.seq}` for stable list rendering; inline styles only
- `src/App.tsx` — `<ImportProgress />` added outside `<Routes>` (visible on all pages)
- TypeScript: zero errors; 52 backend tests unaffected

### Task 29: Global settings page ✅
- `src/pages/Settings.tsx` — data root picker (IPC selectFolder + PUT /settings/data_root); HDBSCAN sliders (min_cluster_size 2–50, min_samples 1–10, cluster_selection_epsilon 0–1.0 step 0.01); reads/writes `hdbscan_params` as JSON string; clustering runs table per library (ID, run_number, created_at, is_active, params, Activate button); New Clustering Run button per library
- `src/api/types.ts` — `ClusteringRun` interface matching backend `ClusteringRunOut` exactly (nested `parameters` dict, `run_number`, `face_count`, `cluster_count`, `notes`)
- `src/api/client.ts` — `getSetting` catches 404 and returns `{ key, value: null }`; `HdbscanParams` interface; `fetchClusteringRuns`, `triggerClusteringRun` (body: `{ parameters: params }`), `activateClusteringRun` (return: `Promise<ClusteringRun>`)
- `src/App.tsx` — `/settings` route added
- `src/pages/Home.tsx` — Settings link added
- TypeScript: zero errors; 52 backend tests unaffected

---

## Phase 11 Detail (Completed)

### Task 26: People API ✅
- `backend/api/people.py` — 4 endpoints:
  - `GET /libraries/{name}/people/` — only people with ≥1 assignment in active run
  - `PUT /libraries/{name}/people/{id}/rename` — 404 if not found
  - `POST /libraries/{name}/people/reassign` — sets person_id, is_user_corrected=True, corrected_at=now(); 400/404 guards
  - `POST /libraries/{name}/people/merge` — moves all source→target; guards: 400 if no active run, 400 if source==target, 404 if target not found; sets corrected_at=now()
- `backend/tests/test_people_api.py` — 14 tests; 52 backend tests total

### Task 27: People browser React page ✅
- `src/components/PersonCard.tsx` — 160×160 circular avatar; uses `API_BASE` (not hardcoded); keyboard-accessible (`role="button"`, `tabIndex=0`, `onKeyDown`)
- `src/pages/People.tsx` — `/library/:name/people` route; TanStack Query; loading/error/empty states; click navigates to media filtered by person
- `src/api/types.ts` — `Person` interface added
- `src/api/client.ts` — `fetchPeople` function added
- `src/App.tsx` — route `/library/:name/people` added
- TypeScript: zero errors

---

## Phase 10 Detail (Completed)

### Task 23: Clustering dependencies ✅
- `hdbscan==0.8.41` (spec: 0.8.38), `faiss-cpu==1.13.2` (spec: 1.8.0), `scikit-learn==1.8.0` (already installed)
- All pinned in requirements.txt with deviation comments

### Task 24: Clustering engine ✅
- `backend/tasks/clustering.py` — HDBSCAN clustering over all Face embeddings (normalized, euclidean metric)
- Enforces 10-run limit (deletes oldest run, including active, unconditionally)
- Each new run promoted to `is_active=True`; previous active run deactivated atomically
- User corrections from active run carried forward into new run's assignments
- `_match_to_existing_person` filters by `active_run_id` (not all runs)
- `backend/tests/test_clustering.py` — 3 tests: basic run, 10-run limit, correction carry-forward
- Registered in `backend/main.py`: `register_worker("cluster_run", run_cluster_run_task)`
- 32 tests passing (+ 1 slow blip test)

### Task 25: Clustering API ✅
- `backend/api/clustering.py` — 3 endpoints:
  - `GET /libraries/{name}/clustering/runs` — list all runs (ordered by `created_at DESC, id DESC`)
  - `POST /libraries/{name}/clustering/runs` → 202 with `task_id` — enqueues `cluster_run` task
  - `PUT /libraries/{name}/clustering/runs/{id}/activate` → 404 if not found; atomically activates target
- `backend/tests/test_clustering_api.py` — 6 tests covering all endpoints
- 38 tests passing

---

## Phase 9 Detail (Completed)

### Task 21: BLIP-2 dependencies ✅
- `transformers==4.57.6` (spec: 4.44.2 — no Python 3.13 wheel; tokenizers dep fails to build)
- `torch==2.10.0` (spec: 2.4.0 — no Python 3.13 wheel; minimum available is 2.5.0)
- `accelerate==0.34.2` (exact spec version)
- Pinned in requirements.txt with inline comments explaining the substitutions
- 29 tests still passing

### Task 22: BLIP-2 captioning worker ✅
- `backend/tasks/blip.py` — lazy-loads `Blip2Processor` + `Blip2ForConditionalGeneration` (Salesforce/blip2-opt-2.7b)
- Model cached in `{data_root}/models/blip2/`
- Image: PIL open + convert RGB; video: cv2 middle frame (with `cap.release()` in `finally`)
- Caption generation: `max_new_tokens=50`, stored in `item.blip_description`
- Session pattern: `try/finally: gen.close()` (no manual rollback)
- `backend/tests/test_blip.py` — marked `@pytest.mark.slow` (downloads ~5.5GB); excluded from normal runs via `pytest -m "not slow"`
- `slow` marker registered in `pytest.ini` (eliminates PytestUnknownMarkWarning)
- Registered in `backend/main.py`: `queue_runner.register_worker("blip", run_blip_task)`
- 29 tests passing (1 slow test deselected in normal runs)

---

## Phase 8 Detail (Completed)

### Task 19: ML dependencies ✅
- `insightface==0.7.3` added to `backend/requirements.txt`
- `onnxruntime==1.20.1` (spec said 1.19.2; no Python 3.13 wheel exists for that version; 1.20.1 is minimum compatible)
- All 28 pre-existing tests continue to pass

### Task 20: Face detection worker ✅
- `backend/tasks/face_detection.py` — lazy-loads InsightFace `FaceAnalysis(buffalo_l, CPUExecutionProvider, det_size=(640,640))`
- Model stored in `{data_root}/models/insightface/` (not default `~/.insightface/`)
- Per-face: normalized bbox `{x,y,w,h}`, float32 embedding bytes, crop saved to `{data_root}/{library_name}/face_crops/{id}.jpg`
- Cosine similarity deduplication within a run (threshold 0.7)
- Video: samples 1 frame/minute + first/last (deduplicated with `sorted(set(...))`)
- Bbox coordinates clamped to image bounds before crop + DB write
- Session pattern: `gen/next/try-finally: gen.close()` (no manual rollback — generator handles it)
- `backend/tests/test_face_detection.py` — verifies worker runs without error on synthetic 200×200 image
- Registered in `backend/main.py`: `queue_runner.register_worker("face_detection", run_face_detection_task)`
- 29 backend tests passing

---

## Phase 7 Detail (Completed)

### Task 15: Media items API ✅
- `backend/api/media.py` — cursor-paginated GET `/libraries/{name}/media/`, person_id filter, sort_by
- `SORT_COLUMNS = {"imported_at", "id"}` allowlist prevents arbitrary attribute injection
- `stmt.where(False)` when person_id given but no active ClusteringRun (explicit empty result)
- ORM objects serialized inside session `try` block to avoid DetachedInstanceError
- `/thumbnail?path=` endpoint in `backend/main.py`
- 28 backend tests passing

### Task 16: React routing + API client ✅
- `src/api/types.ts` — `MediaItem`, `MediaPage`, `Library` TypeScript interfaces
- `src/api/client.ts` — axios API functions with `encodeURIComponent` on all path segments; `fetchMediaPage` takes optional `personId`
- `src/App.tsx` — `QueryClientProvider` + `BrowserRouter` with `/setup`, `/`, `/library/:name` routes
- `src/pages/Setup.tsx`, `Home.tsx`, `Library.tsx` — stub pages (filled out in Tasks 17–18)
- Fixed: removed `@types/react-router-dom@5` (incompatible with v7 bundled types)
- Fixed: `noImplicitAny: true` override in `tsconfig.web.json`

### Task 17: Setup page + Electron IPC ✅
- `electron/preload/index.ts` — minimal `electronAPI` bridge: `selectFolder`, `selectFiles`
- `electron/main/index.ts` — `ipcMain.handle` for both; dialog attaches to `BrowserWindow.fromWebContents(event.sender)` for proper modal parenting
- `src/env.d.ts` — `window.electronAPI` type declarations
- `src/pages/Setup.tsx` — checks `data_root` on mount, redirects to `/` if set; folder picker UI; error state on save failure

### Task 18: Media grid with infinite scroll ✅
- `src/components/MediaCard.tsx` — thumbnail card with `?path=` query param URL, fallback to filename
- `src/components/MediaGrid.tsx` — `useInfiniteQuery` + `useVirtualizer`, 5-col × 160px rows, `personId` forwarded to API
- `src/pages/Home.tsx` — lists libraries, create-library form with error handling, `data_root` check with `active` cleanup guard
- `src/pages/Library.tsx` — reads `:name` param, decodes before passing to `MediaGrid`

---

## Established Patterns (apply to all future tasks)

### Python backend
- **Session management:** `gen = get_library_session(lib)` → `db = next(gen)` → `try: ... finally: gen.close()`
- **Generator rollback:** The generator in `library_db.py` handles rollback internally via `except BaseException: db.rollback()`. Workers must NOT add their own rollback block — `gen.close()` in `finally` is sufficient and avoids a double-rollback.
- **SQLAlchemy 2.0:** `select()`, `db.scalar()`, `db.scalars().all()` — never `db.query()`
- **Worker signature:** always 5 args `(task_id, task_type, media_item_id, library_name, data_root)`
- **DateTime:** always `DateTime(timezone=True)`; always store timezone-aware values (`.replace(tzinfo=timezone.utc)` after `strptime`)
- **`nullable=False`** on all columns with `default=` that should never be NULL
- **Pydantic v2:** `ConfigDict(from_attributes=True)` on all ORM-backed response models
- **Test fixtures:** no `@pytest.mark.asyncio`; local `client` depends on `use_tmp_data`; `use_tmp_data` has `yield` + teardown (`engine.dispose()` + reset globals); unique lib names via `f"lib_{tmp_path.name}"`
- **`@pytest.mark.slow`:** registered in `pytest.ini` — use for tests that download large models; exclude with `pytest -m "not slow"`
- **ORM serialization:** always call `.model_validate(orm_obj)` or build Pydantic models inside the `try` block before `gen.close()` to avoid `DetachedInstanceError`
- **Ordering stability:** when ordering by `created_at`, always add a secondary `.id` sort key (e.g. `.order_by(ClusteringRun.created_at.desc(), ClusteringRun.id.desc())`) to ensure deterministic results
- **`cap.release()` in finally:** always wrap `cv2.VideoCapture` operations in `try/finally: cap.release()` to prevent file handle leaks
- **Clustering worker signature:** `run_cluster_run_task` has an extra `params: dict | None = None` kwarg — intentional (it operates on the whole library, not a single media item)

### TypeScript frontend
- **`encodeURIComponent`** on all dynamic path segments and query values
- **`noImplicitAny: true`** in `tsconfig.web.json` (overrides upstream `@electron-toolkit/tsconfig` default)
- **IPC handlers:** `ipcMain.handle` (not `.on`) for async invoke/handle; pass `BrowserWindow.fromWebContents(event.sender)` to dialogs
- **`useEffect` async cleanup:** use `active` flag pattern to guard `navigate` calls after unmount
- **`useInfiniteQuery`:** explicit `{ pageParam: T }` type annotation (not `as` cast); `initialPageParam: undefined as T | undefined`
- **`API_BASE`:** exported from `src/api/client.ts` — use it in all components (not hardcoded `http://127.0.0.1:7899`)
- **Interactive divs:** add `role="button"`, `tabIndex={0}`, `onKeyDown` for keyboard accessibility on clickable non-button elements
- **`aria-expanded`:** required on toggle buttons (`role="button"` with expand/collapse state)
- **WebSocket hooks:** use callback ref pattern for elements that mount after loading states; `ResizeObserver` with `useEffect([el])` to track rendered size; exponential-backoff reconnect (1s→30s) with `unmountedRef` guard; `typeof e.data !== 'string'` guard before `JSON.parse`; monotonic `seq` counter for stable list keys
- **`getSetting` 404 handling:** `GET /settings/{key}` returns 404 for unset keys — catch in client and return `{ key, value: null }` so queries resolve cleanly on fresh installs
- **Batch queries over N+1:** when iterating ORM rows to resolve related models, use `.in_()` to batch-load in 2 queries + dict lookup instead of per-row `db.scalar()` calls
- **Callback ref for deferred elements:** when a `useEffect` needs a DOM element that only exists after data loads, use `useState<El | null>(null)` + `useCallback` ref instead of `useRef` + `useEffect([], [])` (which fires before the element mounts)

---

## Key Files

| File | Purpose |
|---|---|
| `electron/main/index.ts` | Electron main process; IPC handlers for folder/file dialogs |
| `electron/main/python.ts` | Python subprocess lifecycle |
| `electron/preload/index.ts` | `electronAPI` context bridge (`selectFolder`, `selectFiles`) |
| `src/App.tsx` | React root with router + query provider |
| `src/api/types.ts` | TypeScript interfaces (`MediaItem`, `MediaPage`, `Library`, `Person`) |
| `src/api/client.ts` | Axios API functions |
| `src/pages/Setup.tsx` | First-run data root wizard |
| `src/pages/Home.tsx` | Library list + create |
| `src/pages/Library.tsx` | Per-library media grid |
| `src/components/MediaGrid.tsx` | Infinite-scroll virtualised grid |
| `src/components/MediaCard.tsx` | Thumbnail card component |
| `backend/main.py` | FastAPI app; lifespan; all routers; thumbnail endpoint |
| `backend/api/settings.py` | GET/PUT `/settings/{key}` |
| `backend/api/libraries.py` | GET/POST/DELETE `/libraries/` |
| `backend/api/media.py` | Paginated media list, single item, faces endpoint |
| `backend/api/imports.py` | POST import endpoint |
| `backend/api/ws.py` | WebSocket `/ws/progress` + `broadcast()` |
| `backend/db/global_db.py` | Global DB init + session generator |
| `backend/db/models_global.py` | `Setting`, `Library` ORM models |
| `backend/db/library_db.py` | Per-library DB management |
| `backend/db/models_library.py` | 6-table per-library schema |
| `backend/tasks/scanner.py` | Recursive media file scanner |
| `backend/tasks/queue.py` | Synchronous `TaskQueue` (testing) |
| `backend/tasks/queue_runner.py` | Async production queue runner |
| `backend/tasks/thumbnail.py` | Thumbnail generation worker |
| `backend/tasks/exif.py` | EXIF extraction worker |
| `backend/tasks/face_detection.py` | InsightFace face detection worker with buffalo_l model |
| `backend/tasks/blip.py` | BLIP-2 captioning worker (lazy-loads ~5.5GB model) |
| `backend/tasks/clustering.py` | HDBSCAN clustering engine with run persistence and correction carry-forward |
| `backend/api/clustering.py` | Clustering run list/trigger/activate endpoints |
| `backend/api/people.py` | People list/rename/reassign/merge endpoints |
| `backend/tests/` | 54 tests (+ 1 slow blip test excluded from normal runs) |
| `src/pages/People.tsx` | People browser page |
| `src/components/PersonCard.tsx` | Circular avatar card with keyboard accessibility |
| `src/hooks/useTaskProgress.ts` | WebSocket hook with backoff reconnect + persistent counters |
| `src/components/ImportProgress.tsx` | Fixed-position slide-up task progress panel |
| `src/pages/Settings.tsx` | Global settings: data root, HDBSCAN sliders, clustering runs |
| `src/pages/MediaDetail.tsx` | Media detail: two-column layout, %-based face boxes with reassign dropdown, EXIF, people chips |
| `src/components/AppShell.tsx` | Sidebar layout route: library list, new library form, contextual People link, Settings |
| `src/components/ui/Button.tsx` | Shared primitive — variants: default, ghost, danger, accent |
| `src/components/ui/Input.tsx` | Shared primitive — optional label with auto-generated id via useId() |
| `src/components/ui/Badge.tsx` | Shared primitive — variants: default, accent, success, danger, muted |
| `src/components/ui/Spinner.tsx` | Shared primitive — animated SVG, default size w-5 h-5 |
| `tailwind.config.js` | Tailwind v3 config with custom dark color tokens |
| `postcss.config.js` | PostCSS config for Tailwind |
| `src/index.css` | Tailwind directives + global reset |

---

## Notes for Resuming

- Python venv at `backend/.venv/` — activate before running tests
- 66 backend tests passing: `cd backend && source .venv/bin/activate && pytest -v -m "not slow"`
- 1 additional slow test (BLIP-2): `pytest -v -m slow` (downloads ~5.5GB model on first run)
- TypeScript clean: `npm run typecheck` (zero errors)
- Python version is **3.13** (not 3.11 as stated in CLAUDE.md) — all ML package versions were bumped accordingly
- No git commits have been made — all work is uncommitted
- **UI redesign fully complete.** All 13 tasks done, TypeScript clean, no remaining tasks.
- Use subagent-driven development (one fresh subagent per task + spec + quality review)
- Pause after each task and wait for user approval before continuing
- **No git commits or pushes — ever.** (Only git history checking is allowed.)
