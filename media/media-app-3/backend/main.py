import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from db.global_db import init_global_db
from db.library_db import LibraryNotInitializedError
from api import settings as settings_router
from api import libraries as libraries_router
from api import imports as imports_router
from api import media as media_router
from api import clustering as clustering_router
from api import people as people_router
from api.ws import router as ws_router
from tasks import queue_runner
from tasks.thumbnail import run_thumbnail_task
from tasks.exif import run_exif_task
from tasks.face_detection import run_face_detection_task
from tasks.blip import run_blip_task
from tasks.clustering import run_cluster_run_task


DATA_ROOT = Path(os.environ.get("MEDIA_APP_DATA_ROOT", Path.home() / ".media-manager"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_global_db(DATA_ROOT)
    queue_runner.register_worker("thumbnail", run_thumbnail_task)
    queue_runner.register_worker("exif", run_exif_task)
    queue_runner.register_worker("face_detection", run_face_detection_task)
    queue_runner.register_worker("blip", run_blip_task)
    queue_runner.register_worker("cluster_run", run_cluster_run_task)
    yield


app = FastAPI(title="Media Manager API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(settings_router.router)
app.include_router(libraries_router.router)
app.include_router(imports_router.router)
app.include_router(ws_router)
app.include_router(media_router.router)
app.include_router(clustering_router.router)
app.include_router(people_router.router)


@app.exception_handler(LibraryNotInitializedError)
async def library_not_initialized_handler(_: Request, exc: LibraryNotInitializedError):
    return JSONResponse(status_code=404, content={"detail": f"Library '{exc.library_name}' not found"})


@app.get("/thumbnail")
def serve_thumbnail(path: str):
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    p = Path(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404)
    return FileResponse(p)


@app.get("/health")
def health():
    return {"status": "ok"}
