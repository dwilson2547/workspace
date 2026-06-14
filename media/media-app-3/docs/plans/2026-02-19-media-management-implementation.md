# Media Management Application — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cross-platform desktop media management app with offline AI face detection, BLIP-2 captioning, versioned clustering runs, and infinite-scroll browsing of libraries with 500k+ items.

**Architecture:** Electron shell spawns a Python FastAPI subprocess on startup. React frontend communicates with FastAPI over localhost HTTP + WebSocket. SQLite stores all state; ML tasks run in a ProcessPoolExecutor to bypass the GIL.

**Tech Stack:** Electron + electron-vite + React + TypeScript + TanStack Virtual/Query | Python 3.11 + FastAPI + SQLAlchemy + Alembic + InsightFace + HDBSCAN + FAISS + BLIP-2 + OpenCV + Pillow

**Design doc:** `docs/plans/2026-02-19-media-management-design.md`

---

## Phase 1: Project Scaffolding

### Task 1: Scaffold Electron + React frontend

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- Create: `electron/main/index.ts`, `electron/preload/index.ts`
- Create: `src/main.tsx`, `src/App.tsx`, `src/env.d.ts`

**Step 1: Initialize with electron-vite**
```bash
cd /path/to/media-app-3
npm create @quick-start/electron@latest . -- --template react-ts --skip-git
```
When prompted "Current directory is not empty. Remove existing files and continue?", select Yes (only `docs/` and `readme.md` exist).

**Step 2: Verify dev server starts**
```bash
npm install
npm run dev
```
Expected: Electron window opens showing "Electron + React + TypeScript" default page.

**Step 3: Commit**
```bash
git add .
git commit -m "feat: scaffold electron-vite react-ts project"
```

---

### Task 2: Scaffold Python backend

**Files:**
- Create: `backend/main.py`
- Create: `backend/requirements.txt`
- Create: `backend/api/__init__.py`
- Create: `backend/db/__init__.py`
- Create: `backend/tasks/__init__.py`

**Step 1: Create directory structure**
```bash
mkdir -p backend/api backend/db backend/tasks backend/tests
touch backend/api/__init__.py backend/db/__init__.py backend/tasks/__init__.py
```

**Step 2: Create `backend/requirements.txt`**
```
fastapi[standard]==0.115.0
sqlalchemy==2.0.35
alembic==1.13.3
pydantic==2.9.2
pydantic-settings==2.5.2
aiofiles==24.1.0
pillow==10.4.0
exifread==3.0.0
opencv-python-headless==4.10.0.84
numpy==1.26.4
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2
```

**Step 3: Create `backend/main.py`**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Media Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}
```

**Step 4: Install dependencies and verify**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 7899 --reload
```
Expected: `GET http://localhost:7899/health` returns `{"status":"ok"}`

**Step 5: Create `backend/tests/test_health.py`**
```python
from httpx import AsyncClient, ASGITransport
import pytest
from main import app


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

**Step 6: Run tests**
```bash
pytest tests/test_health.py -v
```
Expected: PASS

**Step 7: Commit**
```bash
git add backend/
git commit -m "feat: scaffold fastapi backend with health endpoint"
```

---

### Task 3: Electron spawns Python subprocess

**Files:**
- Modify: `electron/main/index.ts`
- Create: `electron/main/python.ts`

**Step 1: Create `electron/main/python.ts`**
```typescript
import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import path from 'path'

let pythonProcess: ChildProcess | null = null
const PORT = 7899

export function startPythonBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const backendDir = path.join(app.getAppPath(), 'backend')
    const pythonBin = process.platform === 'win32'
      ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
      : path.join(backendDir, '.venv', 'bin', 'python')

    pythonProcess = spawn(pythonBin, [
      '-m', 'uvicorn', 'main:app', '--port', String(PORT), '--host', '127.0.0.1'
    ], { cwd: backendDir })

    pythonProcess.stdout?.on('data', (data) => {
      const msg = data.toString()
      if (msg.includes('Application startup complete')) resolve()
    })

    pythonProcess.stderr?.on('data', (data) => {
      const msg = data.toString()
      if (msg.includes('Application startup complete')) resolve()
    })

    pythonProcess.on('error', reject)
    setTimeout(() => resolve(), 5000) // fallback timeout
  })
}

export function stopPythonBackend(): void {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
}

export { PORT }
```

**Step 2: Modify `electron/main/index.ts`** — import and call `startPythonBackend()` before creating the window, call `stopPythonBackend()` on `app.on('will-quit')`.

Key additions:
```typescript
import { startPythonBackend, stopPythonBackend } from './python'

// In app.whenReady():
await startPythonBackend()
createWindow()

// After app ready block:
app.on('will-quit', () => stopPythonBackend())
```

**Step 3: Verify integration**
```bash
npm run dev
```
Expected: Electron opens, Python process starts, `http://localhost:7899/health` returns `{"status":"ok"}`

**Step 4: Commit**
```bash
git commit -am "feat: electron spawns and manages python subprocess"
```

---

### Task 4: Set up Python testing infrastructure

**Files:**
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

**Step 1: Create `backend/pytest.ini`**
```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

**Step 2: Create `backend/tests/conftest.py`**
```python
import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
```

**Step 3: Run full test suite**
```bash
cd backend && pytest -v
```
Expected: 1 test passes.

**Step 4: Commit**
```bash
git commit -am "chore: configure pytest with asyncio and shared client fixture"
```

---

## Phase 2: Global Settings Database

### Task 5: Global DB models

**Files:**
- Create: `backend/db/global_db.py`
- Create: `backend/db/models_global.py`

**Step 1: Create `backend/db/global_db.py`**
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pathlib import Path
from typing import Generator


_engine = None
_SessionLocal = None


def init_global_db(data_root: Path) -> None:
    global _engine, _SessionLocal
    data_root.mkdir(parents=True, exist_ok=True)
    db_path = data_root / "settings.db"
    _engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    _SessionLocal = sessionmaker(bind=_engine)
    from db.models_global import GlobalBase
    GlobalBase.metadata.create_all(_engine)


def get_global_db() -> Generator[Session, None, None]:
    assert _SessionLocal is not None, "Global DB not initialized"
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Step 2: Create `backend/db/models_global.py`**
```python
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime, timezone


class GlobalBase(DeclarativeBase):
    pass


class Setting(GlobalBase):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(String, nullable=True)


class Library(GlobalBase):
    __tablename__ = "libraries"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_accessed_at = Column(DateTime, nullable=True)
```

**Step 3: Write test `backend/tests/test_global_db.py`**
```python
import pytest
from pathlib import Path
from db.global_db import init_global_db, get_global_db
from db.models_global import Setting, Library


def test_init_creates_tables(tmp_path):
    init_global_db(tmp_path)
    gen = get_global_db()
    db = next(gen)
    db.add(Setting(key="data_root", value=str(tmp_path)))
    db.commit()
    result = db.query(Setting).filter_by(key="data_root").first()
    assert result.value == str(tmp_path)
    db.close()


def test_library_creation(tmp_path):
    init_global_db(tmp_path)
    gen = get_global_db()
    db = next(gen)
    lib = Library(name="My Library")
    db.add(lib)
    db.commit()
    db.refresh(lib)
    assert lib.id is not None
    assert lib.name == "My Library"
    db.close()
```

**Step 4: Run tests**
```bash
cd backend && pytest tests/test_global_db.py -v
```
Expected: 2 tests pass.

**Step 5: Commit**
```bash
git commit -am "feat: global settings db models and initialization"
```

---

### Task 6: Settings API endpoints

**Files:**
- Create: `backend/api/settings.py`
- Modify: `backend/main.py`

**Step 1: Create `backend/api/settings.py`**
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from db.global_db import get_global_db
from db.models_global import Setting

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingOut(BaseModel):
    key: str
    value: str | None


class SettingIn(BaseModel):
    value: str


@router.get("/{key}", response_model=SettingOut)
def get_setting(key: str, db: Session = Depends(get_global_db)):
    row = db.query(Setting).filter_by(key=key).first()
    if not row:
        raise HTTPException(status_code=404, detail="Setting not found")
    return SettingOut(key=row.key, value=row.value)


@router.put("/{key}", response_model=SettingOut)
def set_setting(key: str, body: SettingIn, db: Session = Depends(get_global_db)):
    row = db.query(Setting).filter_by(key=key).first()
    if row:
        row.value = body.value
    else:
        row = Setting(key=key, value=body.value)
        db.add(row)
    db.commit()
    return SettingOut(key=row.key, value=row.value)
```

**Step 2: Modify `backend/main.py`** — wire up the router and DB initialization:
```python
import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.global_db import init_global_db
from api import settings as settings_router


DATA_ROOT = Path(os.environ.get("MEDIA_APP_DATA_ROOT", Path.home() / ".media-manager"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_global_db(DATA_ROOT)
    yield


app = FastAPI(title="Media Manager API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(settings_router.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

**Step 3: Write test `backend/tests/test_settings_api.py`**
```python
import pytest
import os
from pathlib import Path


@pytest.fixture(autouse=True)
def use_tmp_data(tmp_path, monkeypatch):
    monkeypatch.setenv("MEDIA_APP_DATA_ROOT", str(tmp_path))
    # Re-initialize DB with tmp path
    from db import global_db
    global_db._engine = None
    global_db._SessionLocal = None
    from db.global_db import init_global_db
    init_global_db(tmp_path)


@pytest.mark.asyncio
async def test_set_and_get_setting(client):
    r = await client.put("/settings/data_root", json={"value": "/some/path"})
    assert r.status_code == 200
    r = await client.get("/settings/data_root")
    assert r.json()["value"] == "/some/path"


@pytest.mark.asyncio
async def test_missing_setting_returns_404(client):
    r = await client.get("/settings/nonexistent")
    assert r.status_code == 404
```

**Step 4: Run tests**
```bash
cd backend && pytest tests/test_settings_api.py -v
```
Expected: 2 tests pass.

**Step 5: Commit**
```bash
git commit -am "feat: settings CRUD API endpoints"
```

---

### Task 7: Libraries API endpoints

**Files:**
- Create: `backend/api/libraries.py`
- Modify: `backend/main.py`

**Step 1: Create `backend/api/libraries.py`**
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
from db.global_db import get_global_db
from db.models_global import Library

router = APIRouter(prefix="/libraries", tags=["libraries"])


class LibraryOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    last_accessed_at: datetime | None

    model_config = {"from_attributes": True}


class LibraryIn(BaseModel):
    name: str


@router.get("/", response_model=list[LibraryOut])
def list_libraries(db: Session = Depends(get_global_db)):
    return db.query(Library).order_by(Library.created_at).all()


@router.post("/", response_model=LibraryOut, status_code=201)
def create_library(body: LibraryIn, db: Session = Depends(get_global_db)):
    if db.query(Library).filter_by(name=body.name).first():
        raise HTTPException(status_code=409, detail="Library name already exists")
    lib = Library(name=body.name)
    db.add(lib)
    db.commit()
    db.refresh(lib)
    return lib


@router.delete("/{library_id}", status_code=204)
def delete_library(library_id: int, db: Session = Depends(get_global_db)):
    lib = db.query(Library).filter_by(id=library_id).first()
    if not lib:
        raise HTTPException(status_code=404, detail="Library not found")
    db.delete(lib)
    db.commit()
```

**Step 2: Add router to `backend/main.py`**
```python
from api import libraries as libraries_router
app.include_router(libraries_router.router)
```

**Step 3: Write test `backend/tests/test_libraries_api.py`**
```python
@pytest.mark.asyncio
async def test_create_and_list_library(client):
    r = await client.post("/libraries/", json={"name": "Vacation 2024"})
    assert r.status_code == 201
    assert r.json()["name"] == "Vacation 2024"

    r = await client.get("/libraries/")
    assert len(r.json()) == 1


@pytest.mark.asyncio
async def test_duplicate_name_rejected(client):
    await client.post("/libraries/", json={"name": "Photos"})
    r = await client.post("/libraries/", json={"name": "Photos"})
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_delete_library(client):
    r = await client.post("/libraries/", json={"name": "To Delete"})
    lib_id = r.json()["id"]
    r = await client.delete(f"/libraries/{lib_id}")
    assert r.status_code == 204
    r = await client.get("/libraries/")
    assert len(r.json()) == 0
```

**Step 4: Run tests**
```bash
cd backend && pytest tests/test_libraries_api.py -v
```
Expected: 3 tests pass.

**Step 5: Commit**
```bash
git commit -am "feat: library CRUD API endpoints"
```

---

## Phase 3: Per-Library Database

### Task 8: Per-library DB models

**Files:**
- Create: `backend/db/library_db.py`
- Create: `backend/db/models_library.py`

**Step 1: Create `backend/db/models_library.py`**
```python
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, LargeBinary, JSON
)
from sqlalchemy.orm import DeclarativeBase, relationship
from datetime import datetime, timezone


class LibraryBase(DeclarativeBase):
    pass


class MediaItem(LibraryBase):
    __tablename__ = "media_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    file_path = Column(String, nullable=False)        # absolute path, not unique
    file_name = Column(String, nullable=False)
    file_hash = Column(String, nullable=True)
    media_type = Column(String, nullable=False)       # 'image' | 'video'
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)           # seconds, videos only
    captured_at = Column(DateTime, nullable=True)
    imported_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    exif_data = Column(JSON, nullable=True)
    blip_description = Column(Text, nullable=True)
    thumbnail_path = Column(String, nullable=True)
    is_missing = Column(Boolean, default=False)

    tasks = relationship("Task", back_populates="media_item", cascade="all, delete-orphan")
    faces = relationship("Face", back_populates="media_item", cascade="all, delete-orphan")


class Task(LibraryBase):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    task_type = Column(String, nullable=False)
    # types: thumbnail, exif, face_detection, blip, cluster_run
    status = Column(String, nullable=False, default="pending")
    # statuses: pending, processing, completed, failed
    priority = Column(Integer, nullable=False, default=5)
    retry_count = Column(Integer, default=0)
    media_item_id = Column(Integer, ForeignKey("media_items.id", ondelete="CASCADE"), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    media_item = relationship("MediaItem", back_populates="tasks")


class Face(LibraryBase):
    __tablename__ = "faces"
    id = Column(Integer, primary_key=True, autoincrement=True)
    media_item_id = Column(Integer, ForeignKey("media_items.id", ondelete="CASCADE"), nullable=False)
    bounding_box = Column(JSON, nullable=False)       # {x, y, w, h} as fractions of image size
    embedding = Column(LargeBinary, nullable=True)    # 512-dim float32 numpy array
    detection_confidence = Column(Float, nullable=True)
    crop_path = Column(String, nullable=True)

    media_item = relationship("MediaItem", back_populates="faces")
    assignments = relationship("FaceAssignment", back_populates="face", cascade="all, delete-orphan")


class Person(LibraryBase):
    __tablename__ = "people"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=True)
    cover_face_id = Column(Integer, ForeignKey("faces.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    assignments = relationship("FaceAssignment", back_populates="person")


class ClusteringRun(LibraryBase):
    __tablename__ = "clustering_runs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_number = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    parameters = Column(JSON, nullable=False)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=False)
    face_count = Column(Integer, default=0)
    cluster_count = Column(Integer, default=0)

    assignments = relationship("FaceAssignment", back_populates="run", cascade="all, delete-orphan")


class FaceAssignment(LibraryBase):
    __tablename__ = "face_assignments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    face_id = Column(Integer, ForeignKey("faces.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(Integer, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    clustering_run_id = Column(Integer, ForeignKey("clustering_runs.id", ondelete="CASCADE"), nullable=False)
    confidence = Column(Float, nullable=True)
    is_user_corrected = Column(Boolean, default=False)
    corrected_at = Column(DateTime, nullable=True)

    face = relationship("Face", back_populates="assignments")
    person = relationship("Person", back_populates="assignments")
    run = relationship("ClusteringRun", back_populates="assignments")
```

**Step 2: Create `backend/db/library_db.py`**
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pathlib import Path
from typing import Generator
from db.models_library import LibraryBase


_engines: dict[str, object] = {}
_sessions: dict[str, sessionmaker] = {}


def get_library_db_path(data_root: Path, library_name: str) -> Path:
    lib_dir = data_root / library_name
    lib_dir.mkdir(parents=True, exist_ok=True)
    return lib_dir / "library.db"


def init_library_db(data_root: Path, library_name: str) -> None:
    db_path = get_library_db_path(data_root, library_name)
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    LibraryBase.metadata.create_all(engine)
    _engines[library_name] = engine
    _sessions[library_name] = sessionmaker(bind=engine)


def get_library_session(library_name: str) -> Generator[Session, None, None]:
    assert library_name in _sessions, f"Library '{library_name}' not initialized"
    db = _sessions[library_name]()
    try:
        yield db
    finally:
        db.close()
```

**Step 3: Write test `backend/tests/test_library_db.py`**
```python
from pathlib import Path
from db.library_db import init_library_db, get_library_session
from db.models_library import MediaItem


def test_media_items_allow_duplicate_filenames(tmp_path):
    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)

    # Two files with same name, different paths
    db.add(MediaItem(file_path="/photos/vacation/img001.jpg", file_name="img001.jpg", media_type="image"))
    db.add(MediaItem(file_path="/downloads/img001.jpg", file_name="img001.jpg", media_type="image"))
    db.commit()

    results = db.query(MediaItem).filter_by(file_name="img001.jpg").all()
    assert len(results) == 2
    db.close()
```

**Step 4: Run test**
```bash
cd backend && pytest tests/test_library_db.py -v
```
Expected: PASS

**Step 5: Commit**
```bash
git commit -am "feat: per-library SQLite models — media_items, tasks, faces, people, clustering_runs, face_assignments"
```

---

## Phase 4: Import System & Task Queue

### Task 9: File scanning utility

**Files:**
- Create: `backend/tasks/scanner.py`
- Create: `backend/tests/test_scanner.py`

**Step 1: Write failing test**
```python
# backend/tests/test_scanner.py
from pathlib import Path
from tasks.scanner import scan_for_media


def test_scans_recursively(tmp_path):
    (tmp_path / "sub").mkdir()
    (tmp_path / "img1.jpg").touch()
    (tmp_path / "sub" / "img2.PNG").touch()
    (tmp_path / "sub" / "document.pdf").touch()  # should be excluded

    results = scan_for_media([str(tmp_path)])
    paths = [r.path for r in results]
    assert any("img1.jpg" in p for p in paths)
    assert any("img2.PNG" in p for p in paths)
    assert not any("document.pdf" in p for p in paths)


def test_accepts_individual_files(tmp_path):
    f = tmp_path / "photo.mp4"
    f.touch()
    results = scan_for_media([str(f)])
    assert len(results) == 1
    assert results[0].media_type == "video"
```

**Step 2: Run test — verify it fails**
```bash
cd backend && pytest tests/test_scanner.py -v
```
Expected: FAIL (ImportError)

**Step 3: Create `backend/tasks/scanner.py`**
```python
from pathlib import Path
from dataclasses import dataclass

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp", ".heic", ".heif"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".wmv", ".m4v", ".flv", ".webm"}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS


@dataclass
class ScannedFile:
    path: str
    file_name: str
    media_type: str  # 'image' | 'video'


def scan_for_media(paths: list[str]) -> list[ScannedFile]:
    results: list[ScannedFile] = []
    for path_str in paths:
        p = Path(path_str)
        if p.is_file():
            _maybe_add(p, results)
        elif p.is_dir():
            for child in sorted(p.rglob("*")):
                if child.is_file():
                    _maybe_add(child, results)
    return results


def _maybe_add(p: Path, results: list[ScannedFile]) -> None:
    ext = p.suffix.lower()
    if ext in IMAGE_EXTENSIONS:
        results.append(ScannedFile(path=str(p), file_name=p.name, media_type="image"))
    elif ext in VIDEO_EXTENSIONS:
        results.append(ScannedFile(path=str(p), file_name=p.name, media_type="video"))
```

**Step 4: Run tests — verify pass**
```bash
cd backend && pytest tests/test_scanner.py -v
```
Expected: 2 tests pass.

**Step 5: Commit**
```bash
git commit -am "feat: recursive media file scanner"
```

---

### Task 10: Task queue engine

**Files:**
- Create: `backend/tasks/queue.py`
- Create: `backend/tests/test_queue.py`

**Step 1: Write failing test**
```python
# backend/tests/test_queue.py
import pytest
from pathlib import Path
from db.library_db import init_library_db, get_library_session
from db.models_library import Task
from tasks.queue import TaskQueue, TaskResult


def make_queue(tmp_path, lib_name="test_lib"):
    init_library_db(tmp_path, lib_name)
    return TaskQueue(library_name=lib_name, max_ml_workers=1, max_io_workers=2)


def test_enqueue_and_drain(tmp_path):
    queue = make_queue(tmp_path)
    gen = get_library_session("test_lib")
    db = next(gen)

    task = Task(task_type="thumbnail", priority=1, status="pending")
    db.add(task)
    db.commit()
    task_id = task.id
    db.close()

    results = []
    def dummy_worker(task_id, task_type, media_item_id):
        return TaskResult(task_id=task_id, success=True, data={})

    queue.register_worker("thumbnail", dummy_worker)
    queue.drain_once("test_lib")

    gen2 = get_library_session("test_lib")
    db2 = next(gen2)
    updated = db2.query(Task).filter_by(id=task_id).first()
    assert updated.status == "completed"
    db2.close()
```

**Step 2: Run — verify fail**
```bash
cd backend && pytest tests/test_queue.py -v
```
Expected: FAIL

**Step 3: Create `backend/tasks/queue.py`**
```python
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, Future
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Any
from sqlalchemy.orm import Session
from db.library_db import get_library_session
from db.models_library import Task
import logging

logger = logging.getLogger(__name__)

IO_TASK_TYPES = {"thumbnail", "exif"}
ML_TASK_TYPES = {"face_detection", "blip"}
SINGLETON_TASK_TYPES = {"cluster_run"}
PRIORITY_MAP = {"thumbnail": 1, "exif": 2, "face_detection": 3, "blip": 4, "cluster_run": 5}
MAX_RETRIES = 3


@dataclass
class TaskResult:
    task_id: int
    success: bool
    data: dict = field(default_factory=dict)
    error: str | None = None


class TaskQueue:
    def __init__(self, library_name: str, max_ml_workers: int = 2, max_io_workers: int = 4):
        self.library_name = library_name
        self._workers: dict[str, Callable] = {}
        self._io_pool = ThreadPoolExecutor(max_workers=max_io_workers)
        self._ml_pool = ProcessPoolExecutor(max_workers=max_ml_workers)
        self._active_futures: dict[int, Future] = {}

    def register_worker(self, task_type: str, fn: Callable) -> None:
        self._workers[task_type] = fn

    def drain_once(self, library_name: str) -> None:
        """Pick next pending task and dispatch it synchronously (for testing)."""
        gen = get_library_session(library_name)
        db = next(gen)
        task = (
            db.query(Task)
            .filter_by(status="pending")
            .order_by(Task.priority, Task.created_at)
            .first()
        )
        if not task:
            db.close()
            return

        task.status = "processing"
        task.started_at = datetime.now(timezone.utc)
        db.commit()
        task_id = task.id
        task_type = task.task_type
        media_item_id = task.media_item_id
        db.close()

        worker = self._workers.get(task_type)
        if not worker:
            self._mark_failed(library_name, task_id, f"No worker registered for {task_type}")
            return

        try:
            result: TaskResult = worker(task_id, task_type, media_item_id)
            self._mark_completed(library_name, task_id)
        except Exception as e:
            self._mark_failed(library_name, task_id, str(e))

    def _mark_completed(self, library_name: str, task_id: int) -> None:
        gen = get_library_session(library_name)
        db = next(gen)
        task = db.query(Task).filter_by(id=task_id).first()
        if task:
            task.status = "completed"
            task.completed_at = datetime.now(timezone.utc)
            db.commit()
        db.close()

    def _mark_failed(self, library_name: str, task_id: int, error: str) -> None:
        gen = get_library_session(library_name)
        db = next(gen)
        task = db.query(Task).filter_by(id=task_id).first()
        if task:
            task.retry_count += 1
            if task.retry_count >= MAX_RETRIES:
                task.status = "failed"
                task.error_message = error
                task.completed_at = datetime.now(timezone.utc)
            else:
                task.status = "pending"
            db.commit()
        db.close()
```

**Step 4: Run tests**
```bash
cd backend && pytest tests/test_queue.py -v
```
Expected: PASS

**Step 5: Commit**
```bash
git commit -am "feat: sqlite-backed task queue with worker registration and retry logic"
```

---

### Task 11: Async queue loop with WebSocket broadcast

**Files:**
- Create: `backend/tasks/queue_runner.py`
- Create: `backend/api/ws.py`
- Modify: `backend/main.py`

**Step 1: Create `backend/api/ws.py`**
```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio

router = APIRouter()
_connections: list[WebSocket] = []


@router.websocket("/ws/progress")
async def progress_ws(ws: WebSocket):
    await ws.accept()
    _connections.append(ws)
    try:
        while True:
            await asyncio.sleep(30)  # keep-alive
    except WebSocketDisconnect:
        _connections.remove(ws)


async def broadcast(event: dict) -> None:
    dead = []
    for ws in _connections:
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _connections.remove(ws)
```

**Step 2: Create `backend/tasks/queue_runner.py`**
```python
import asyncio
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any
from db.library_db import get_library_session
from db.models_library import Task
from api.ws import broadcast
import logging

logger = logging.getLogger(__name__)

IO_TYPES = {"thumbnail", "exif"}
ML_TYPES = {"face_detection", "blip", "cluster_run"}
PRIORITY_MAP = {"thumbnail": 1, "exif": 2, "face_detection": 3, "blip": 4, "cluster_run": 5}
MAX_RETRIES = 3

_workers: dict[str, Any] = {}
_io_pool = ThreadPoolExecutor(max_workers=4)
_ml_pool = ProcessPoolExecutor(max_workers=2)
_running = False


def register_worker(task_type: str, fn) -> None:
    _workers[task_type] = fn


async def run_loop(library_name: str, poll_interval: float = 1.0) -> None:
    global _running
    _running = True
    loop = asyncio.get_event_loop()
    while _running:
        gen = get_library_session(library_name)
        db = next(gen)
        task = (
            db.query(Task)
            .filter_by(status="pending")
            .order_by(Task.priority, Task.created_at)
            .first()
        )
        if not task:
            db.close()
            await asyncio.sleep(poll_interval)
            continue

        task.status = "processing"
        task.started_at = datetime.now(timezone.utc)
        db.commit()
        task_id, task_type, media_item_id = task.id, task.task_type, task.media_item_id
        db.close()

        await broadcast({"type": "task_started", "task_id": task_id, "task_type": task_type, "media_item_id": media_item_id})

        worker = _workers.get(task_type)
        if not worker:
            await _mark_failed(library_name, task_id, f"No worker for {task_type}")
            continue

        pool = _io_pool if task_type in IO_TYPES else _ml_pool
        try:
            await loop.run_in_executor(pool, worker, task_id, task_type, media_item_id, library_name)
            await _mark_completed(library_name, task_id)
            await broadcast({"type": "task_completed", "task_id": task_id, "task_type": task_type, "media_item_id": media_item_id})
        except Exception as e:
            await _mark_failed(library_name, task_id, str(e))
            await broadcast({"type": "task_failed", "task_id": task_id, "error": str(e)})


async def _mark_completed(library_name: str, task_id: int) -> None:
    gen = get_library_session(library_name)
    db = next(gen)
    task = db.query(Task).filter_by(id=task_id).first()
    if task:
        task.status = "completed"
        task.completed_at = datetime.now(timezone.utc)
        db.commit()
    db.close()


async def _mark_failed(library_name: str, task_id: int, error: str) -> None:
    gen = get_library_session(library_name)
    db = next(gen)
    task = db.query(Task).filter_by(id=task_id).first()
    if task:
        task.retry_count += 1
        if task.retry_count >= MAX_RETRIES:
            task.status = "failed"
            task.error_message = error
            task.completed_at = datetime.now(timezone.utc)
        else:
            task.status = "pending"
        db.commit()
    db.close()


def stop() -> None:
    global _running
    _running = False
```

**Step 3: Mount WebSocket router in `backend/main.py`**
```python
from api.ws import router as ws_router
app.include_router(ws_router)
```

**Step 4: Commit**
```bash
git commit -am "feat: async queue runner with websocket broadcast"
```

---

### Task 12: Import API endpoint

**Files:**
- Create: `backend/api/imports.py`
- Modify: `backend/main.py`

**Step 1: Create `backend/api/imports.py`**
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
import hashlib
from db.library_db import get_library_session, init_library_db
from db.models_library import MediaItem, Task
from tasks.scanner import scan_for_media
from tasks import queue_runner
import os

router = APIRouter(prefix="/libraries/{library_name}/import", tags=["import"])

PRIORITY = {"thumbnail": 1, "exif": 2, "face_detection": 3, "blip": 4}


class ImportRequest(BaseModel):
    paths: list[str]


class ImportResponse(BaseModel):
    accepted: int
    skipped: int
    task_count: int


@router.post("/", response_model=ImportResponse)
def start_import(library_name: str, body: ImportRequest):
    data_root = Path(os.environ.get("MEDIA_APP_DATA_ROOT", Path.home() / ".media-manager"))
    init_library_db(data_root, library_name)

    scanned = scan_for_media(body.paths)
    accepted = skipped = task_count = 0

    gen = get_library_session(library_name)
    db = next(gen)

    existing_paths = {row.file_path for row in db.query(MediaItem.file_path).all()}

    for f in scanned:
        if f.path in existing_paths:
            skipped += 1
            continue
        item = MediaItem(file_path=f.path, file_name=f.file_name, media_type=f.media_type)
        db.add(item)
        db.flush()  # get item.id

        for task_type, priority in PRIORITY.items():
            db.add(Task(task_type=task_type, priority=priority, media_item_id=item.id))
            task_count += 1

        accepted += 1

    db.commit()
    db.close()
    return ImportResponse(accepted=accepted, skipped=skipped, task_count=task_count)
```

**Step 2: Add router to `backend/main.py`**
```python
from api import imports as imports_router
app.include_router(imports_router.router)
```

**Step 3: Write test `backend/tests/test_import_api.py`**
```python
@pytest.mark.asyncio
async def test_import_creates_media_items_and_tasks(client, tmp_path):
    # Create test files
    img = tmp_path / "photo.jpg"
    img.touch()

    r = await client.post("/libraries/test_lib/import/", json={"paths": [str(tmp_path)]})
    assert r.status_code == 200
    data = r.json()
    assert data["accepted"] == 1
    assert data["task_count"] == 4  # thumbnail, exif, face_detection, blip


@pytest.mark.asyncio
async def test_import_skips_duplicate_paths(client, tmp_path):
    img = tmp_path / "photo.jpg"
    img.touch()
    await client.post("/libraries/test_lib/import/", json={"paths": [str(tmp_path)]})
    r = await client.post("/libraries/test_lib/import/", json={"paths": [str(tmp_path)]})
    assert r.json()["skipped"] == 1
    assert r.json()["accepted"] == 0
```

**Step 4: Run tests**
```bash
cd backend && pytest tests/test_import_api.py -v
```
Expected: 2 tests pass.

**Step 5: Commit**
```bash
git commit -am "feat: import API endpoint with recursive scan and task enqueue"
```

---

## Phase 5: Thumbnail Generation Worker

### Task 13: Thumbnail worker

**Files:**
- Create: `backend/tasks/thumbnail.py`
- Create: `backend/tests/test_thumbnail.py`

**Step 1: Write failing test**
```python
# backend/tests/test_thumbnail.py
import pytest
from pathlib import Path
from PIL import Image
from db.library_db import init_library_db, get_library_session
from db.models_library import MediaItem, Task
from tasks.thumbnail import run_thumbnail_task


def make_test_image(path: Path) -> Path:
    img = Image.new("RGB", (1920, 1080), color=(100, 150, 200))
    img.save(path)
    return path


def test_thumbnail_generated(tmp_path):
    img_path = make_test_image(tmp_path / "test.jpg")
    thumb_dir = tmp_path / "thumbnails"
    thumb_dir.mkdir()

    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    item = MediaItem(file_path=str(img_path), file_name="test.jpg", media_type="image")
    db.add(item)
    db.flush()
    task = Task(task_type="thumbnail", priority=1, media_item_id=item.id)
    db.add(task)
    db.commit()
    task_id = task.id
    item_id = item.id
    db.close()

    run_thumbnail_task(task_id, "thumbnail", item_id, "test_lib", str(tmp_path))

    gen2 = get_library_session("test_lib")
    db2 = next(gen2)
    updated = db2.query(MediaItem).filter_by(id=item_id).first()
    assert updated.thumbnail_path is not None
    assert Path(updated.thumbnail_path).exists()
    db2.close()
```

**Step 2: Run — verify fail**
```bash
cd backend && pytest tests/test_thumbnail.py -v
```

**Step 3: Create `backend/tasks/thumbnail.py`**
```python
from pathlib import Path
from PIL import Image
import cv2
from db.library_db import get_library_session
from db.models_library import MediaItem

THUMB_SIZE = (400, 300)


def run_thumbnail_task(task_id: int, task_type: str, media_item_id: int, library_name: str, data_root: str) -> None:
    gen = get_library_session(library_name)
    db = next(gen)
    item = db.query(MediaItem).filter_by(id=media_item_id).first()
    if not item:
        db.close()
        raise ValueError(f"MediaItem {media_item_id} not found")

    thumb_dir = Path(data_root) / library_name / "thumbnails"
    thumb_dir.mkdir(parents=True, exist_ok=True)
    thumb_path = thumb_dir / f"{media_item_id}.jpg"

    if item.media_type == "image":
        _make_image_thumbnail(item.file_path, thumb_path)
    else:
        _make_video_thumbnail(item.file_path, thumb_path)

    item.thumbnail_path = str(thumb_path)
    db.commit()
    db.close()


def _make_image_thumbnail(src: str, dest: Path) -> None:
    with Image.open(src) as img:
        img.thumbnail(THUMB_SIZE, Image.LANCZOS)
        img.convert("RGB").save(dest, "JPEG", quality=85)


def _make_video_thumbnail(src: str, dest: Path) -> None:
    cap = cv2.VideoCapture(src)
    cap.set(cv2.CAP_PROP_POS_FRAMES, 30)  # ~1s in at 30fps
    ret, frame = cap.read()
    cap.release()
    if ret:
        img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        img.thumbnail(THUMB_SIZE, Image.LANCZOS)
        img.save(dest, "JPEG", quality=85)
```

**Step 4: Register worker in `backend/main.py`** (add in lifespan):
```python
from tasks import queue_runner
from tasks.thumbnail import run_thumbnail_task
queue_runner.register_worker("thumbnail", run_thumbnail_task)
```

**Step 5: Run tests**
```bash
cd backend && pytest tests/test_thumbnail.py -v
```
Expected: PASS

**Step 6: Commit**
```bash
git commit -am "feat: thumbnail generation worker for images and videos"
```

---

## Phase 6: EXIF Extraction Worker

### Task 14: EXIF worker

**Files:**
- Create: `backend/tasks/exif.py`
- Create: `backend/tests/test_exif.py`

**Step 1: Write failing test**
```python
# backend/tests/test_exif.py
from pathlib import Path
from PIL import Image
import piexif
from db.library_db import init_library_db, get_library_session
from db.models_library import MediaItem, Task
from tasks.exif import run_exif_task


def make_image_with_exif(path: Path) -> Path:
    img = Image.new("RGB", (100, 100))
    exif_bytes = piexif.dump({
        "0th": {piexif.ImageIFD.Make: b"TestCamera"},
        "Exif": {piexif.ExifIFD.DateTimeOriginal: b"2024:06:15 12:00:00"},
    })
    img.save(path, exif=exif_bytes)
    return path


def test_exif_extracted(tmp_path):
    img_path = make_image_with_exif(tmp_path / "test.jpg")
    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    item = MediaItem(file_path=str(img_path), file_name="test.jpg", media_type="image")
    db.add(item)
    db.flush()
    task = Task(task_type="exif", priority=2, media_item_id=item.id)
    db.add(task)
    db.commit()
    task_id, item_id = task.id, item.id
    db.close()

    run_exif_task(task_id, "exif", item_id, "test_lib", str(tmp_path))

    gen2 = get_library_session("test_lib")
    db2 = next(gen2)
    updated = db2.query(MediaItem).filter_by(id=item_id).first()
    assert updated.exif_data is not None
    assert "Image Make" in updated.exif_data or len(updated.exif_data) > 0
    db2.close()
```

**Step 2: Add `piexif` to `backend/requirements.txt`**
```
piexif==1.1.3
```
Then: `pip install piexif`

**Step 3: Create `backend/tasks/exif.py`**
```python
from pathlib import Path
import exifread
from db.library_db import get_library_session
from db.models_library import MediaItem
from datetime import datetime


def run_exif_task(task_id: int, task_type: str, media_item_id: int, library_name: str, data_root: str) -> None:
    gen = get_library_session(library_name)
    db = next(gen)
    item = db.query(MediaItem).filter_by(id=media_item_id).first()
    if not item:
        db.close()
        raise ValueError(f"MediaItem {media_item_id} not found")

    exif_data = {}
    captured_at = None

    if item.media_type == "image":
        try:
            with open(item.file_path, "rb") as f:
                tags = exifread.process_file(f, details=False)
            exif_data = {str(k): str(v) for k, v in tags.items()}
            date_str = exif_data.get("EXIF DateTimeOriginal") or exif_data.get("Image DateTime")
            if date_str:
                try:
                    captured_at = datetime.strptime(date_str, "%Y:%m:%d %H:%M:%S")
                except ValueError:
                    pass
        except Exception:
            pass

    item.exif_data = exif_data
    if captured_at:
        item.captured_at = captured_at
    db.commit()
    db.close()
```

**Step 4: Run tests**
```bash
cd backend && pytest tests/test_exif.py -v
```
Expected: PASS

**Step 5: Commit**
```bash
git commit -am "feat: exif extraction worker"
```

---

## Phase 7: Media API & React Grid

### Task 15: Media items API with cursor pagination

**Files:**
- Create: `backend/api/media.py`
- Modify: `backend/main.py`

**Step 1: Create `backend/api/media.py`**
```python
from fastapi import APIRouter, Query
from pydantic import BaseModel
from datetime import datetime
from db.library_db import get_library_session
from db.models_library import MediaItem

router = APIRouter(prefix="/libraries/{library_name}/media", tags=["media"])


class MediaItemOut(BaseModel):
    id: int
    file_path: str
    file_name: str
    media_type: str
    width: int | None
    height: int | None
    captured_at: datetime | None
    imported_at: datetime
    thumbnail_path: str | None
    blip_description: str | None
    is_missing: bool

    model_config = {"from_attributes": True}


class MediaPage(BaseModel):
    items: list[MediaItemOut]
    next_cursor: int | None


@router.get("/", response_model=MediaPage)
def list_media(
    library_name: str,
    cursor: int | None = Query(None),
    limit: int = Query(100, le=500),
    sort_by: str = Query("imported_at"),
    person_id: int | None = Query(None),
):
    gen = get_library_session(library_name)
    db = next(gen)

    q = db.query(MediaItem).filter_by(is_missing=False)

    if person_id is not None:
        from db.models_library import Face, FaceAssignment, ClusteringRun
        active_run = db.query(ClusteringRun).filter_by(is_active=True).first()
        if active_run:
            face_media_ids = (
                db.query(Face.media_item_id)
                .join(FaceAssignment, FaceAssignment.face_id == Face.id)
                .filter(FaceAssignment.person_id == person_id, FaceAssignment.clustering_run_id == active_run.id)
                .distinct()
            )
            q = q.filter(MediaItem.id.in_(face_media_ids))

    if cursor:
        q = q.filter(MediaItem.id > cursor)

    sort_col = getattr(MediaItem, sort_by, MediaItem.imported_at)
    items = q.order_by(sort_col, MediaItem.id).limit(limit + 1).all()
    db.close()

    has_more = len(items) > limit
    items = items[:limit]
    next_cursor = items[-1].id if has_more and items else None

    return MediaPage(items=items, next_cursor=next_cursor)


@router.get("/{media_id}", response_model=MediaItemOut)
def get_media_item(library_name: str, media_id: int):
    from fastapi import HTTPException
    gen = get_library_session(library_name)
    db = next(gen)
    item = db.query(MediaItem).filter_by(id=media_id).first()
    db.close()
    if not item:
        raise HTTPException(status_code=404)
    return item
```

**Step 2: Add router to `backend/main.py`**
```python
from api import media as media_router
app.include_router(media_router.router)
```

**Step 3: Write test**
```python
# backend/tests/test_media_api.py
@pytest.mark.asyncio
async def test_pagination(client, tmp_path):
    # Create 5 media items
    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    for i in range(5):
        db.add(MediaItem(file_path=f"/photos/{i}.jpg", file_name=f"{i}.jpg", media_type="image"))
    db.commit()
    db.close()

    r = await client.get("/libraries/test_lib/media/?limit=3")
    data = r.json()
    assert len(data["items"]) == 3
    assert data["next_cursor"] is not None

    r2 = await client.get(f"/libraries/test_lib/media/?limit=3&cursor={data['next_cursor']}")
    data2 = r2.json()
    assert len(data2["items"]) == 2
    assert data2["next_cursor"] is None
```

**Step 4: Run test**
```bash
cd backend && pytest tests/test_media_api.py -v
```
Expected: PASS

**Step 5: Commit**
```bash
git commit -am "feat: media items API with cursor-based pagination and person filter"
```

---

### Task 16: React app structure and API client

**Files:**
- Create: `src/api/client.ts`
- Create: `src/api/types.ts`
- Modify: `src/App.tsx`
- Create: `src/pages/Setup.tsx`, `src/pages/Home.tsx`, `src/pages/Library.tsx`

**Step 1: Install frontend dependencies**
```bash
npm install @tanstack/react-query@5 @tanstack/react-virtual@3 react-router-dom axios
npm install -D @types/react-router-dom
```

**Step 2: Create `src/api/types.ts`**
```typescript
export interface MediaItem {
  id: number
  file_path: string
  file_name: string
  media_type: 'image' | 'video'
  width: number | null
  height: number | null
  captured_at: string | null
  imported_at: string
  thumbnail_path: string | null
  blip_description: string | null
  is_missing: boolean
}

export interface MediaPage {
  items: MediaItem[]
  next_cursor: number | null
}

export interface Library {
  id: number
  name: string
  created_at: string
  last_accessed_at: string | null
}
```

**Step 3: Create `src/api/client.ts`**
```typescript
import axios from 'axios'

export const API_BASE = 'http://127.0.0.1:7899'
const api = axios.create({ baseURL: API_BASE })

export const fetchLibraries = () => api.get<Library[]>('/libraries/').then(r => r.data)
export const createLibrary = (name: string) => api.post<Library>('/libraries/', { name }).then(r => r.data)

export const fetchMediaPage = (libraryName: string, cursor?: number, limit = 100) =>
  api.get<MediaPage>(`/libraries/${libraryName}/media/`, {
    params: { cursor, limit }
  }).then(r => r.data)

export const getSetting = (key: string) =>
  api.get<{ key: string; value: string }>(`/settings/${key}`).then(r => r.data)

export const setSetting = (key: string, value: string) =>
  api.put(`/settings/${key}`, { value })
```

**Step 4: Set up routing in `src/App.tsx`**
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Setup from './pages/Setup'
import Home from './pages/Home'
import Library from './pages/Library'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="/" element={<Home />} />
          <Route path="/library/:name" element={<Library />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

**Step 5: Verify app loads**
```bash
npm run dev
```
Expected: Electron window shows app without errors in console.

**Step 6: Commit**
```bash
git commit -am "feat: react routing structure and typed API client"
```

---

### Task 17: Setup page (first-run wizard)

**Files:**
- Create: `src/pages/Setup.tsx`

**Step 1: Create `src/pages/Setup.tsx`**

The setup page must:
- Check if `data_root` setting exists on mount
- If not, show a directory picker prompt
- Use Electron's `dialog.showOpenDialog` via the preload bridge to pick a folder
- Save the path via `PUT /settings/data_root`
- Redirect to `/` on success

**Step 2: Expose file dialog in `electron/preload/index.ts`**
```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
})
```

**Step 3: Handle IPC in `electron/main/index.ts`**
```typescript
import { ipcMain, dialog } from 'electron'

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.filePaths[0] ?? null
})

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections', 'openDirectory'],
  })
  return result.filePaths
})
```

**Step 4: Add type declarations for `window.electronAPI` in `src/env.d.ts`**
```typescript
interface Window {
  electronAPI: {
    selectFolder: () => Promise<string | null>
    selectFiles: () => Promise<string[]>
  }
}
```

**Step 5: Commit**
```bash
git commit -am "feat: setup page and electron IPC for file/folder dialogs"
```

---

### Task 18: Library home and media grid with infinite scroll

**Files:**
- Create: `src/pages/Home.tsx`
- Create: `src/pages/Library.tsx`
- Create: `src/components/MediaGrid.tsx`
- Create: `src/components/MediaCard.tsx`

**Step 1: Create `src/components/MediaCard.tsx`**
```typescript
import { MediaItem } from '../api/types'
import { API_BASE } from '../api/client'

interface Props { item: MediaItem; onClick?: () => void }

export default function MediaCard({ item, onClick }: Props) {
  const src = item.thumbnail_path
    ? `${API_BASE}/thumbnail/${encodeURIComponent(item.thumbnail_path)}`
    : undefined

  return (
    <div onClick={onClick} style={{ cursor: 'pointer', width: '200px', height: '150px', overflow: 'hidden', background: '#222' }}>
      {src ? <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ color: '#666', padding: 8 }}>{item.file_name}</div>}
    </div>
  )
}
```

**Step 2: Create `src/components/MediaGrid.tsx`** using TanStack Query infinite queries + TanStack Virtual for windowed rendering. Key implementation:

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useEffect } from 'react'
import { fetchMediaPage } from '../api/client'
import { MediaItem } from '../api/types'
import MediaCard from './MediaCard'

const COLUMNS = 5
const CARD_HEIGHT = 160

interface Props { libraryName: string; personId?: number }

export default function MediaGrid({ libraryName, personId }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['media', libraryName, personId],
    queryFn: ({ pageParam }) => fetchMediaPage(libraryName, pageParam as number | undefined),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    initialPageParam: undefined,
  })

  const items: MediaItem[] = data?.pages.flatMap(p => p.items) ?? []
  const rowCount = Math.ceil(items.length / COLUMNS)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: 3,
  })

  // Trigger next page fetch when near bottom
  useEffect(() => {
    const lastItem = virtualizer.getVirtualItems().at(-1)
    if (!lastItem) return
    if (lastItem.index >= rowCount - 2 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [virtualizer.getVirtualItems()])

  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vRow => {
          const rowItems = items.slice(vRow.index * COLUMNS, (vRow.index + 1) * COLUMNS)
          return (
            <div key={vRow.key} style={{ position: 'absolute', top: vRow.start, display: 'flex', gap: 4 }}>
              {rowItems.map(item => <MediaCard key={item.id} item={item} />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 3: Add thumbnail serving endpoint in `backend/api/media.py`**
```python
from fastapi.responses import FileResponse

@router.get("/thumbnail")
def serve_thumbnail(path: str):
    from fastapi import HTTPException
    p = Path(path)
    if not p.exists():
        raise HTTPException(status_code=404)
    return FileResponse(p)
```
Note: Add a top-level thumbnail route in `main.py` too:
```python
@app.get("/thumbnail")
def serve_thumbnail_global(path: str):
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    from pathlib import Path
    p = Path(path)
    if not p.exists():
        raise HTTPException(status_code=404)
    return FileResponse(p)
```

**Step 4: Commit**
```bash
git commit -am "feat: media grid with tanstack virtual infinite scroll"
```

---

## Phase 8: Face Detection Pipeline

### Task 19: Install ML dependencies

**Step 1: Add to `backend/requirements.txt`**
```
insightface==0.7.3
onnxruntime==1.19.2
```

**Step 2: Install**
```bash
pip install insightface onnxruntime
```

Note: InsightFace downloads `buffalo_l` model to `~/.insightface/models/` on first use. We will override this to use `{data_root}/models/insightface/` for portability.

**Step 3: Commit**
```bash
git commit -am "chore: add insightface and onnxruntime dependencies"
```

---

### Task 20: Face detection worker

**Files:**
- Create: `backend/tasks/face_detection.py`
- Create: `backend/tests/test_face_detection.py`

**Step 1: Write failing test**
```python
# backend/tests/test_face_detection.py
import pytest
from pathlib import Path
from PIL import Image, ImageDraw
from db.library_db import init_library_db, get_library_session
from db.models_library import MediaItem, Task, Face
from tasks.face_detection import run_face_detection_task


def make_portrait(path: Path) -> Path:
    """Create a simple 200x200 image — InsightFace may not detect faces in synthetic images.
    This test verifies the pipeline runs without error and writes to DB."""
    img = Image.new("RGB", (200, 200), (200, 180, 160))
    img.save(path)
    return path


def test_face_detection_runs_without_error(tmp_path):
    img_path = make_portrait(tmp_path / "portrait.jpg")
    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    item = MediaItem(file_path=str(img_path), file_name="portrait.jpg", media_type="image",
                     width=200, height=200)
    db.add(item)
    db.flush()
    task = Task(task_type="face_detection", priority=3, media_item_id=item.id)
    db.add(task)
    db.commit()
    task_id, item_id = task.id, item.id
    db.close()

    # Should not raise
    run_face_detection_task(task_id, "face_detection", item_id, "test_lib", str(tmp_path))
```

**Step 2: Create `backend/tasks/face_detection.py`**
```python
from pathlib import Path
import numpy as np
import cv2
from db.library_db import get_library_session
from db.models_library import MediaItem, Face
import os

_app = None  # InsightFace FaceAnalysis, lazy-loaded


def _get_app(model_root: str):
    global _app
    if _app is None:
        import insightface
        from insightface.app import FaceAnalysis
        _app = FaceAnalysis(
            name="buffalo_l",
            root=model_root,
            providers=["CPUExecutionProvider"]
        )
        _app.prepare(ctx_id=0, det_size=(640, 640))
    return _app


def run_face_detection_task(
    task_id: int, task_type: str, media_item_id: int, library_name: str, data_root: str
) -> None:
    gen = get_library_session(library_name)
    db = next(gen)
    item = db.query(MediaItem).filter_by(id=media_item_id).first()
    if not item:
        db.close()
        raise ValueError(f"MediaItem {media_item_id} not found")

    model_root = str(Path(data_root) / "models" / "insightface")
    crop_dir = Path(data_root) / library_name / "face_crops"
    crop_dir.mkdir(parents=True, exist_ok=True)

    frames = _get_frames(item)
    fa = _get_app(model_root)

    seen_embeddings = []
    for frame_img in frames:
        faces_detected = fa.get(frame_img)
        for face in faces_detected:
            emb = face.embedding  # np.ndarray shape (512,)
            if _is_duplicate(emb, seen_embeddings):
                continue
            seen_embeddings.append(emb)

            h, w = frame_img.shape[:2]
            bbox = face.bbox.astype(int)  # [x1, y1, x2, y2]
            bb = {
                "x": float(bbox[0]) / w,
                "y": float(bbox[1]) / h,
                "w": float(bbox[2] - bbox[0]) / w,
                "h": float(bbox[3] - bbox[1]) / h,
            }

            face_record = Face(
                media_item_id=media_item_id,
                bounding_box=bb,
                embedding=emb.astype(np.float32).tobytes(),
                detection_confidence=float(face.det_score),
            )
            db.add(face_record)
            db.flush()

            crop = frame_img[bbox[1]:bbox[3], bbox[0]:bbox[2]]
            crop_path = crop_dir / f"{face_record.id}.jpg"
            cv2.imwrite(str(crop_path), crop)
            face_record.crop_path = str(crop_path)

    db.commit()
    db.close()


def _get_frames(item) -> list:
    import cv2
    if item.media_type == "image":
        img = cv2.imread(item.file_path)
        return [img] if img is not None else []

    frames = []
    cap = cv2.VideoCapture(item.file_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    sample_interval = int(fps * 60)  # 1 frame per minute

    sample_positions = [0] + list(range(sample_interval, total, sample_interval)) + [max(0, total - 1)]
    for pos in sample_positions:
        cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
        ret, frame = cap.read()
        if ret:
            frames.append(frame)
    cap.release()
    return frames


def _is_duplicate(emb: np.ndarray, seen: list, threshold: float = 0.7) -> bool:
    for other in seen:
        sim = float(np.dot(emb, other) / (np.linalg.norm(emb) * np.linalg.norm(other) + 1e-8))
        if sim > threshold:
            return True
    return False
```

**Step 3: Run test**
```bash
cd backend && pytest tests/test_face_detection.py -v
```
Expected: PASS (on first run, InsightFace will download the `buffalo_l` model ~500MB)

**Step 4: Register worker in `backend/main.py`**
```python
from tasks.face_detection import run_face_detection_task
queue_runner.register_worker("face_detection", run_face_detection_task)
```

**Step 5: Commit**
```bash
git commit -am "feat: insightface face detection worker with video frame sampling"
```

---

## Phase 9: BLIP-2 Captioning Worker

### Task 21: Install BLIP-2 dependencies

**Step 1: Add to `backend/requirements.txt`**
```
transformers==4.44.2
torch==2.4.0
accelerate==0.34.2
```

**Step 2: Install**
```bash
pip install transformers torch accelerate
```
Note: `torch` is CPU-only here (~200MB). GPU support can be added later by swapping to `torch+cu121`.

**Step 3: Commit**
```bash
git commit -am "chore: add transformers and torch for blip-2"
```

---

### Task 22: BLIP-2 captioning worker

**Files:**
- Create: `backend/tasks/blip.py`
- Create: `backend/tests/test_blip.py`

**Step 1: Write failing test**
```python
# backend/tests/test_blip.py
# Note: this test downloads blip2-opt-2.7b (~5.5GB) on first run
# Skip in CI with: pytest -m "not slow"
import pytest
from pathlib import Path
from PIL import Image
from db.library_db import init_library_db, get_library_session
from db.models_library import MediaItem, Task
from tasks.blip import run_blip_task


@pytest.mark.slow
def test_blip_generates_description(tmp_path):
    img = Image.new("RGB", (224, 224), color=(100, 150, 200))
    img_path = tmp_path / "test.jpg"
    img.save(img_path)

    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    item = MediaItem(file_path=str(img_path), file_name="test.jpg", media_type="image")
    db.add(item)
    db.flush()
    task = Task(task_type="blip", priority=4, media_item_id=item.id)
    db.add(task)
    db.commit()
    task_id, item_id = task.id, item.id
    db.close()

    run_blip_task(task_id, "blip", item_id, "test_lib", str(tmp_path))

    gen2 = get_library_session("test_lib")
    db2 = next(gen2)
    updated = db2.query(MediaItem).filter_by(id=item_id).first()
    assert updated.blip_description is not None
    assert len(updated.blip_description) > 0
    db2.close()
```

**Step 2: Create `backend/tasks/blip.py`**
```python
from pathlib import Path
from PIL import Image
import cv2
from db.library_db import get_library_session
from db.models_library import MediaItem

MODEL_ID = "Salesforce/blip2-opt-2.7b"
_processor = None
_model = None


def _get_model(model_root: str):
    global _processor, _model
    if _processor is None:
        from transformers import Blip2Processor, Blip2ForConditionalGeneration
        import torch
        cache_dir = str(Path(model_root) / "blip2")
        _processor = Blip2Processor.from_pretrained(MODEL_ID, cache_dir=cache_dir)
        _model = Blip2ForConditionalGeneration.from_pretrained(
            MODEL_ID, cache_dir=cache_dir, torch_dtype=torch.float32
        )
        _model.eval()
    return _processor, _model


def run_blip_task(task_id: int, task_type: str, media_item_id: int, library_name: str, data_root: str) -> None:
    import torch
    gen = get_library_session(library_name)
    db = next(gen)
    item = db.query(MediaItem).filter_by(id=media_item_id).first()
    if not item:
        db.close()
        raise ValueError(f"MediaItem {media_item_id} not found")

    model_root = str(Path(data_root) / "models")
    processor, model = _get_model(model_root)

    image = _get_representative_image(item)
    if image is None:
        db.close()
        return

    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        ids = model.generate(**inputs, max_new_tokens=50)
    caption = processor.batch_decode(ids, skip_special_tokens=True)[0].strip()

    item.blip_description = caption
    db.commit()
    db.close()


def _get_representative_image(item) -> Image.Image | None:
    if item.media_type == "image":
        try:
            return Image.open(item.file_path).convert("RGB")
        except Exception:
            return None

    cap = cv2.VideoCapture(item.file_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, total // 2)
    ret, frame = cap.read()
    cap.release()
    if ret:
        import numpy as np
        return Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    return None
```

**Step 3: Register worker in `backend/main.py`**
```python
from tasks.blip import run_blip_task
queue_runner.register_worker("blip", run_blip_task)
```

**Step 4: Run test (skipped in normal runs)**
```bash
cd backend && pytest tests/test_blip.py -v -m slow
```

**Step 5: Commit**
```bash
git commit -am "feat: blip-2 captioning worker"
```

---

## Phase 10: Clustering System

### Task 23: Install clustering dependencies

**Step 1: Add to `backend/requirements.txt`**
```
hdbscan==0.8.38
faiss-cpu==1.8.0
scikit-learn==1.5.2
```

**Step 2: Install**
```bash
pip install hdbscan faiss-cpu scikit-learn
```

**Step 3: Commit**
```bash
git commit -am "chore: add hdbscan and faiss-cpu for clustering"
```

---

### Task 24: Clustering engine

**Files:**
- Create: `backend/tasks/clustering.py`
- Create: `backend/tests/test_clustering.py`

**Step 1: Write failing test**
```python
# backend/tests/test_clustering.py
import numpy as np
import pytest
from pathlib import Path
from db.library_db import init_library_db, get_library_session
from db.models_library import MediaItem, Face, ClusteringRun, FaceAssignment, Person
from tasks.clustering import run_cluster_run_task


def seed_faces(db, n_clusters=3, faces_per_cluster=5):
    """Create synthetic face embeddings with clear cluster structure."""
    rng = np.random.default_rng(42)
    centroids = rng.normal(size=(n_clusters, 512)).astype(np.float32)
    centroids /= np.linalg.norm(centroids, axis=1, keepdims=True)

    item = MediaItem(file_path="/fake/img.jpg", file_name="img.jpg", media_type="image")
    db.add(item)
    db.flush()

    for c_idx in range(n_clusters):
        for _ in range(faces_per_cluster):
            emb = centroids[c_idx] + rng.normal(scale=0.05, size=512).astype(np.float32)
            emb /= np.linalg.norm(emb)
            face = Face(media_item_id=item.id, bounding_box={"x": 0, "y": 0, "w": 0.1, "h": 0.1},
                        embedding=emb.tobytes(), detection_confidence=0.99)
            db.add(face)
    db.commit()


def test_clustering_creates_run_and_assignments(tmp_path):
    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    seed_faces(db, n_clusters=3, faces_per_cluster=5)
    db.close()

    params = {"min_cluster_size": 3, "min_samples": 1, "cluster_selection_epsilon": 0.0}
    run_cluster_run_task(None, "cluster_run", None, "test_lib", str(tmp_path), params=params)

    gen2 = get_library_session("test_lib")
    db2 = next(gen2)
    run = db2.query(ClusteringRun).first()
    assert run is not None
    assert run.cluster_count >= 2  # HDBSCAN may merge some
    assignments = db2.query(FaceAssignment).all()
    assert len(assignments) == 15  # all faces assigned
    db2.close()


def test_max_10_runs_enforced(tmp_path):
    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    seed_faces(db, n_clusters=2, faces_per_cluster=3)
    db.close()

    params = {"min_cluster_size": 2, "min_samples": 1, "cluster_selection_epsilon": 0.0}
    for _ in range(11):
        run_cluster_run_task(None, "cluster_run", None, "test_lib", str(tmp_path), params=params)

    gen2 = get_library_session("test_lib")
    db2 = next(gen2)
    count = db2.query(ClusteringRun).count()
    assert count == 10
    db2.close()
```

**Step 2: Create `backend/tasks/clustering.py`**
```python
from pathlib import Path
from typing import Any
import numpy as np
from db.library_db import get_library_session
from db.models_library import Face, ClusteringRun, FaceAssignment, Person

MAX_RUNS = 10


def run_cluster_run_task(
    task_id: int | None,
    task_type: str,
    media_item_id: int | None,
    library_name: str,
    data_root: str,
    params: dict | None = None,
) -> None:
    import hdbscan

    params = params or {"min_cluster_size": 5, "min_samples": 1, "cluster_selection_epsilon": 0.0}

    gen = get_library_session(library_name)
    db = next(gen)

    faces = db.query(Face).filter(Face.embedding.isnot(None)).all()
    if not faces:
        db.close()
        return

    embeddings = np.array([
        np.frombuffer(f.embedding, dtype=np.float32) for f in faces
    ])
    face_ids = [f.id for f in faces]

    # Normalize for cosine similarity
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-8
    embeddings_norm = embeddings / norms

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=params.get("min_cluster_size", 5),
        min_samples=params.get("min_samples", 1),
        cluster_selection_epsilon=params.get("cluster_selection_epsilon", 0.0),
        metric="euclidean",
    )
    labels = clusterer.fit_predict(embeddings_norm)

    unique_labels = set(labels) - {-1}
    cluster_count = len(unique_labels)

    # Enforce 10-run limit: delete oldest non-active run
    _enforce_run_limit(db)

    existing_run_count = db.query(ClusteringRun).count()
    run = ClusteringRun(
        run_number=existing_run_count + 1,
        parameters=params,
        face_count=len(faces),
        cluster_count=cluster_count,
    )
    db.add(run)
    db.flush()

    # Get user-corrected assignments from the previously active run
    active_run = db.query(ClusteringRun).filter_by(is_active=True).first()
    corrections: dict[int, int | None] = {}
    if active_run:
        corrected = db.query(FaceAssignment).filter_by(
            clustering_run_id=active_run.id, is_user_corrected=True
        ).all()
        corrections = {a.face_id: a.person_id for a in corrected}

    # Map cluster label → Person (match to existing named persons via centroid similarity)
    label_to_person: dict[int, Person] = {}
    existing_people = db.query(Person).all()

    for label in unique_labels:
        mask = labels == label
        centroid = embeddings_norm[mask].mean(axis=0)
        matched_person = _match_to_existing_person(centroid, existing_people, embeddings_norm, face_ids, db)
        if matched_person:
            label_to_person[label] = matched_person
        else:
            person = Person()
            db.add(person)
            db.flush()
            label_to_person[label] = person

    # Write assignments
    for i, face_id in enumerate(face_ids):
        label = labels[i]
        person_id = label_to_person[label].id if label != -1 else None

        # User correction overrides HDBSCAN result
        is_corrected = face_id in corrections
        if is_corrected:
            person_id = corrections[face_id]

        assignment = FaceAssignment(
            face_id=face_id,
            person_id=person_id,
            clustering_run_id=run.id,
            confidence=float(clusterer.probabilities_[i]) if label != -1 else None,
            is_user_corrected=is_corrected,
        )
        db.add(assignment)

    db.commit()
    db.close()


def _enforce_run_limit(db) -> None:
    runs = db.query(ClusteringRun).order_by(ClusteringRun.created_at).all()
    if len(runs) >= MAX_RUNS:
        # Delete oldest non-active run
        for run in runs:
            if not run.is_active:
                db.delete(run)
                db.flush()
                break


def _match_to_existing_person(
    centroid: np.ndarray,
    people: list,
    all_embeddings: np.ndarray,
    face_ids: list[int],
    db,
    threshold: float = 0.6,
) -> Any | None:
    """Find existing named person whose face embeddings are closest to this centroid."""
    best_person = None
    best_sim = threshold

    for person in people:
        if not person.name:
            continue
        # Get embeddings of faces that have been user-corrected to this person
        corrected = db.query(FaceAssignment).filter(
            FaceAssignment.person_id == person.id,
            FaceAssignment.is_user_corrected == True,
        ).all()
        if not corrected:
            continue
        corrected_face_ids = {a.face_id for a in corrected}
        indices = [i for i, fid in enumerate(face_ids) if fid in corrected_face_ids]
        if not indices:
            continue
        person_centroid = all_embeddings[indices].mean(axis=0)
        sim = float(np.dot(centroid, person_centroid))
        if sim > best_sim:
            best_sim = sim
            best_person = person

    return best_person
```

**Step 3: Run tests**
```bash
cd backend && pytest tests/test_clustering.py -v
```
Expected: 2 tests pass.

**Step 4: Register worker and add API endpoint for triggering a run**

In `backend/main.py`:
```python
from tasks.clustering import run_cluster_run_task
queue_runner.register_worker("cluster_run", run_cluster_run_task)
```

**Step 5: Commit**
```bash
git commit -am "feat: hdbscan clustering engine with run persistence, 10-run limit, and correction carry-forward"
```

---

### Task 25: Clustering API endpoints

**Files:**
- Create: `backend/api/clustering.py`
- Modify: `backend/main.py`

**Step 1: Create `backend/api/clustering.py`**
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from db.library_db import get_library_session
from db.models_library import ClusteringRun, Task, FaceAssignment

router = APIRouter(prefix="/libraries/{library_name}/clustering", tags=["clustering"])


class ClusteringRunOut(BaseModel):
    id: int
    run_number: int
    created_at: datetime
    parameters: dict
    notes: str | None
    is_active: bool
    face_count: int
    cluster_count: int

    model_config = {"from_attributes": True}


class NewRunRequest(BaseModel):
    parameters: dict
    notes: str | None = None


@router.get("/runs", response_model=list[ClusteringRunOut])
def list_runs(library_name: str):
    gen = get_library_session(library_name)
    db = next(gen)
    runs = db.query(ClusteringRun).order_by(ClusteringRun.created_at.desc()).all()
    db.close()
    return runs


@router.post("/runs", status_code=202)
def trigger_run(library_name: str, body: NewRunRequest):
    gen = get_library_session(library_name)
    db = next(gen)
    task = Task(task_type="cluster_run", priority=5, status="pending")
    db.add(task)
    db.commit()
    task_id = task.id
    db.close()
    return {"task_id": task_id}


@router.put("/runs/{run_id}/activate", response_model=ClusteringRunOut)
def activate_run(library_name: str, run_id: int):
    gen = get_library_session(library_name)
    db = next(gen)
    runs = db.query(ClusteringRun).all()
    target = None
    for run in runs:
        run.is_active = run.id == run_id
        if run.id == run_id:
            target = run
    if not target:
        db.close()
        raise HTTPException(status_code=404)
    db.commit()
    db.refresh(target)
    db.close()
    return target
```

**Step 2: Register router in `backend/main.py`**
```python
from api import clustering as clustering_router
app.include_router(clustering_router.router)
```

**Step 3: Commit**
```bash
git commit -am "feat: clustering run API (list, trigger, activate)"
```

---

## Phase 11: People Browser & Face Corrections

### Task 26: People API endpoints

**Files:**
- Create: `backend/api/people.py`
- Modify: `backend/main.py`

**Step 1: Create `backend/api/people.py`**
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.library_db import get_library_session
from db.models_library import Person, ClusteringRun, FaceAssignment, Face

router = APIRouter(prefix="/libraries/{library_name}/people", tags=["people"])


class PersonOut(BaseModel):
    id: int
    name: str | None
    cover_face_crop_path: str | None
    face_count: int

    model_config = {"from_attributes": True}


class RenameRequest(BaseModel):
    name: str


class ReassignRequest(BaseModel):
    face_id: int
    target_person_id: int | None  # None = unassign


@router.get("/", response_model=list[PersonOut])
def list_people(library_name: str):
    gen = get_library_session(library_name)
    db = next(gen)
    active_run = db.query(ClusteringRun).filter_by(is_active=True).first()
    if not active_run:
        db.close()
        return []

    people = db.query(Person).all()
    result = []
    for p in people:
        count = db.query(FaceAssignment).filter_by(
            clustering_run_id=active_run.id, person_id=p.id
        ).count()
        if count == 0:
            continue
        cover_path = None
        if p.cover_face_id:
            face = db.query(Face).filter_by(id=p.cover_face_id).first()
            if face:
                cover_path = face.crop_path
        result.append(PersonOut(id=p.id, name=p.name, cover_face_crop_path=cover_path, face_count=count))

    db.close()
    return result


@router.put("/{person_id}/rename")
def rename_person(library_name: str, person_id: int, body: RenameRequest):
    gen = get_library_session(library_name)
    db = next(gen)
    person = db.query(Person).filter_by(id=person_id).first()
    if not person:
        db.close()
        raise HTTPException(status_code=404)
    person.name = body.name
    db.commit()
    db.close()
    return {"ok": True}


@router.post("/reassign")
def reassign_face(library_name: str, body: ReassignRequest):
    from datetime import datetime, timezone
    gen = get_library_session(library_name)
    db = next(gen)
    active_run = db.query(ClusteringRun).filter_by(is_active=True).first()
    if not active_run:
        db.close()
        raise HTTPException(status_code=400, detail="No active clustering run")

    assignment = db.query(FaceAssignment).filter_by(
        face_id=body.face_id, clustering_run_id=active_run.id
    ).first()
    if not assignment:
        db.close()
        raise HTTPException(status_code=404)

    assignment.person_id = body.target_person_id
    assignment.is_user_corrected = True
    assignment.corrected_at = datetime.now(timezone.utc)
    db.commit()
    db.close()
    return {"ok": True}


@router.post("/merge")
def merge_people(library_name: str, source_id: int, target_id: int):
    gen = get_library_session(library_name)
    db = next(gen)
    active_run = db.query(ClusteringRun).filter_by(is_active=True).first()
    if not active_run:
        db.close()
        raise HTTPException(status_code=400, detail="No active clustering run")

    assignments = db.query(FaceAssignment).filter_by(
        clustering_run_id=active_run.id, person_id=source_id
    ).all()
    for a in assignments:
        a.person_id = target_id
        a.is_user_corrected = True
    db.commit()
    db.close()
    return {"ok": True, "merged_count": len(assignments)}
```

**Step 2: Add router to `backend/main.py`**
```python
from api import people as people_router
app.include_router(people_router.router)
```

**Step 3: Write test**
```python
# backend/tests/test_people_api.py
# Test that rename and reassign update DB correctly
@pytest.mark.asyncio
async def test_rename_person(client, tmp_path):
    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    person = Person(name="Unknown")
    db.add(person)
    db.commit()
    person_id = person.id
    db.close()

    r = await client.put(f"/libraries/test_lib/people/{person_id}/rename", json={"name": "Alice"})
    assert r.status_code == 200

    gen2 = get_library_session("test_lib")
    db2 = next(gen2)
    updated = db2.query(Person).filter_by(id=person_id).first()
    assert updated.name == "Alice"
    db2.close()
```

**Step 4: Run test**
```bash
cd backend && pytest tests/test_people_api.py -v
```
Expected: PASS

**Step 5: Commit**
```bash
git commit -am "feat: people API — list, rename, reassign face, merge persons"
```

---

### Task 27: People browser React page

**Files:**
- Create: `src/pages/People.tsx`
- Create: `src/components/PersonCard.tsx`
- Modify: `src/App.tsx` (add route)

**Step 1: Create `src/components/PersonCard.tsx`**
```typescript
interface Props {
  person: { id: number; name: string | null; cover_face_crop_path: string | null; face_count: number }
  onClick: () => void
}
export default function PersonCard({ person, onClick }: Props) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', width: 160, textAlign: 'center' }}>
      <div style={{ width: 160, height: 160, borderRadius: '50%', overflow: 'hidden', background: '#333', margin: '0 auto' }}>
        {person.cover_face_crop_path
          ? <img src={`http://localhost:7899/thumbnail?path=${encodeURIComponent(person.cover_face_crop_path)}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ lineHeight: '160px', color: '#888' }}>?</div>
        }
      </div>
      <div style={{ marginTop: 8 }}>{person.name ?? `Unknown #${person.id}`}</div>
      <div style={{ color: '#888', fontSize: 12 }}>{person.face_count} photos</div>
    </div>
  )
}
```

**Step 2: Add route in `src/App.tsx`**
```typescript
import People from './pages/People'
// In <Routes>:
<Route path="/library/:name/people" element={<People />} />
```

**Step 3: Commit**
```bash
git commit -am "feat: people browser page with person cards"
```

---

## Phase 12: Global Settings UI & Task Progress

### Task 28: Task progress panel

**Files:**
- Create: `src/components/ImportProgress.tsx`
- Create: `src/hooks/useTaskProgress.ts`

**Step 1: Create `src/hooks/useTaskProgress.ts`**
```typescript
import { useEffect, useState } from 'react'

interface TaskEvent {
  type: 'task_started' | 'task_completed' | 'task_failed'
  task_id: number
  task_type?: string
  media_item_id?: number
  error?: string
}

export function useTaskProgress() {
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:7899/ws/progress')
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e) => {
      const event: TaskEvent = JSON.parse(e.data)
      setEvents(prev => [event, ...prev].slice(0, 100))
    }
    return () => ws.close()
  }, [])

  return { events, connected }
}
```

**Step 2: Create `src/components/ImportProgress.tsx`** — a slide-up panel showing the last 20 task events, a count of pending/processing/completed/failed tasks, and a connection status indicator.

**Step 3: Commit**
```bash
git commit -am "feat: websocket task progress panel"
```

---

### Task 29: Global settings page

**Files:**
- Create: `src/pages/Setup.tsx` (full implementation)

The Settings page exposes:
- Data root directory picker (uses `window.electronAPI.selectFolder()`)
- Default HDBSCAN parameters: `min_cluster_size` (slider 2–50), `min_samples` (slider 1–10), `cluster_selection_epsilon` (slider 0–1.0)
- Clustering runs table (list, activate, delete)
- "New Clustering Run" button with parameter form

All settings read/write via the `/settings/` API. Clustering runs read/write via `/libraries/{name}/clustering/runs`.

**Step: Commit**
```bash
git commit -am "feat: global settings page with clustering controls"
```

---

## Phase 13: Media Detail View

### Task 30: Media detail page

**Files:**
- Create: `src/pages/MediaDetail.tsx`

The detail page shows:
- Full-resolution image (served via `GET /thumbnail?path=...` for now — later add a dedicated full-res endpoint)
- Face bounding box overlays (drawn as SVG rectangles over the image, linked to person names)
- EXIF data table (key/value pairs from `exif_data`)
- BLIP description
- Assigned people chips with click-through to person filter

Add a `GET /libraries/{name}/media/{id}/faces` endpoint that returns faces + their active-run person assignment:

```python
# In backend/api/media.py
@router.get("/{media_id}/faces")
def get_media_faces(library_name: str, media_id: int):
    gen = get_library_session(library_name)
    db = next(gen)
    active_run = db.query(ClusteringRun).filter_by(is_active=True).first()
    faces = db.query(Face).filter_by(media_item_id=media_id).all()
    result = []
    for face in faces:
        person = None
        if active_run:
            assignment = db.query(FaceAssignment).filter_by(
                face_id=face.id, clustering_run_id=active_run.id
            ).first()
            if assignment and assignment.person_id:
                p = db.query(Person).filter_by(id=assignment.person_id).first()
                person = {"id": p.id, "name": p.name} if p else None
        result.append({
            "id": face.id,
            "bounding_box": face.bounding_box,
            "crop_path": face.crop_path,
            "person": person,
        })
    db.close()
    return result
```

**Step: Commit**
```bash
git commit -am "feat: media detail view with face overlays and EXIF display"
```

---

## Phase 14: Integration & Polish

### Task 31: Wire up queue runner to active library

Modify `backend/main.py` lifespan to start the queue runner loop as a background asyncio task when a library is opened. Add `POST /libraries/{name}/open` endpoint that initializes the library DB and starts the runner for that library.

```python
import asyncio
from tasks import queue_runner

@app.post("/libraries/{library_name}/open")
async def open_library(library_name: str, background_tasks: BackgroundTasks):
    init_library_db(DATA_ROOT, library_name)
    # Start queue runner as background asyncio task
    asyncio.create_task(queue_runner.run_loop(library_name))
    return {"ok": True}
```

**Commit:**
```bash
git commit -am "feat: library open endpoint starts queue runner"
```

---

### Task 32: Missing file detection

Add a `POST /libraries/{name}/check-missing` endpoint that scans all `media_items` and sets `is_missing = True` for any whose `file_path` no longer exists on disk.

```python
@router.post("/check-missing")
def check_missing(library_name: str):
    from pathlib import Path
    gen = get_library_session(library_name)
    db = next(gen)
    items = db.query(MediaItem).all()
    updated = 0
    for item in items:
        missing = not Path(item.file_path).exists()
        if item.is_missing != missing:
            item.is_missing = missing
            updated += 1
    db.commit()
    db.close()
    return {"updated": updated}
```

**Commit:**
```bash
git commit -am "feat: missing file detection endpoint"
```

---

### Task 33: Incremental face matching for new imports

Modify `run_face_detection_task` in `backend/tasks/face_detection.py` to, after writing new faces to the DB, perform FAISS nearest-neighbor matching against the active clustering run's cluster centroids:

```python
def _assign_new_faces_incrementally(face_ids: list[int], library_name: str, db) -> None:
    import faiss
    active_run = db.query(ClusteringRun).filter_by(is_active=True).first()
    if not active_run:
        return

    # Build centroid index from active run
    people_ids = db.query(FaceAssignment.person_id).filter_by(
        clustering_run_id=active_run.id
    ).distinct().all()
    if not people_ids:
        return

    # Build centroid per person
    centroids = []
    centroid_person_ids = []
    for (person_id,) in people_ids:
        if person_id is None:
            continue
        face_ids_for_person = [
            a.face_id for a in db.query(FaceAssignment).filter_by(
                clustering_run_id=active_run.id, person_id=person_id
            ).all()
        ]
        embs = [np.frombuffer(db.query(Face).filter_by(id=fid).first().embedding, dtype=np.float32)
                for fid in face_ids_for_person]
        centroid = np.mean(embs, axis=0)
        centroid /= np.linalg.norm(centroid) + 1e-8
        centroids.append(centroid)
        centroid_person_ids.append(person_id)

    if not centroids:
        return

    index = faiss.IndexFlatIP(512)
    index.add(np.array(centroids, dtype=np.float32))

    THRESHOLD = 0.6
    for face_id in face_ids:
        face = db.query(Face).filter_by(id=face_id).first()
        if not face or not face.embedding:
            continue
        emb = np.frombuffer(face.embedding, dtype=np.float32)
        emb /= np.linalg.norm(emb) + 1e-8
        sims, indices = index.search(emb.reshape(1, -1), 1)
        sim = float(sims[0][0])
        if sim >= THRESHOLD:
            matched_person_id = centroid_person_ids[int(indices[0][0])]
            assignment = FaceAssignment(
                face_id=face_id,
                person_id=matched_person_id,
                clustering_run_id=active_run.id,
                confidence=sim,
                is_user_corrected=False,
            )
            db.add(assignment)
    db.commit()
```

**Commit:**
```bash
git commit -am "feat: incremental face matching against active clustering run using faiss"
```

---

### Task 34: Final test pass and README

**Step 1: Run full test suite**
```bash
cd backend && pytest -v --ignore=tests/test_blip.py
```
Expected: All tests pass (BLIP test skipped — requires model download).

**Step 2: Verify Electron app starts and imports a folder**
1. `npm run dev`
2. Navigate to Setup, set data root
3. Create a library
4. Import a folder of images
5. Verify thumbnails appear in grid
6. Verify task progress panel shows completed tasks

**Step 3: Update `readme.md`** with setup instructions:
- Python venv setup
- npm install
- `npm run dev` to start

**Commit:**
```bash
git commit -am "docs: update readme with setup instructions"
```

---

## Appendix: Default HDBSCAN Parameters

| Parameter | Default | Description |
|---|---|---|
| `min_cluster_size` | 5 | Minimum faces to form a cluster |
| `min_samples` | 1 | Controls how conservative clustering is |
| `cluster_selection_epsilon` | 0.0 | Merge clusters within this distance |

Exposed as sliders in the global settings page. Changing them triggers a new clustering run; the user activates the new run manually after reviewing.

---

## Appendix: Supported Media Extensions

**Images:** `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.tif`, `.webp`, `.heic`, `.heif`

**Videos:** `.mp4`, `.mov`, `.avi`, `.mkv`, `.wmv`, `.m4v`, `.flv`, `.webm`
