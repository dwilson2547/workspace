from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from pathlib import Path
from sqlalchemy import select
import os
from db.library_db import get_library_session, init_library_db
from db.models_library import MediaItem, Task
from tasks.scanner import scan_for_media
from tasks import queue_runner

router = APIRouter(prefix="/libraries/{library_name}/import", tags=["import"])

PRIORITY = {"thumbnail": 1, "exif": 2, "face_detection": 3, "blip": 4}


class ImportRequest(BaseModel):
    paths: list[str]


class ImportResponse(BaseModel):
    accepted: int
    skipped: int
    task_count: int


@router.post("/", response_model=ImportResponse)
async def start_import(library_name: str, body: ImportRequest):
    data_root = Path(os.environ.get("MEDIA_APP_DATA_ROOT", Path.home() / ".media-manager"))
    init_library_db(data_root, library_name)

    scanned = scan_for_media(body.paths)
    accepted = skipped = task_count = 0

    gen = get_library_session(library_name)
    db = next(gen)
    try:
        existing_paths = {
            row for row in db.scalars(select(MediaItem.file_path)).all()
        }

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
    finally:
        gen.close()

    if accepted > 0:
        await queue_runner.ensure_loop_running(library_name, str(data_root))

    return ImportResponse(accepted=accepted, skipped=skipped, task_count=task_count)


@router.post("/reprocess", response_model=ImportResponse)
async def reprocess_library(library_name: str):
    """Queue pipeline tasks for any media items missing thumbnails or descriptions."""
    data_root = Path(os.environ.get("MEDIA_APP_DATA_ROOT", Path.home() / ".media-manager"))
    init_library_db(data_root, library_name)

    gen = get_library_session(library_name)
    db = next(gen)
    task_count = 0
    try:
        items = db.scalars(select(MediaItem)).all()
        for item in items:
            active_types = {
                t.task_type
                for t in db.scalars(
                    select(Task).where(
                        Task.media_item_id == item.id,
                        Task.status.in_(["pending", "processing"]),
                    )
                ).all()
            }
            for task_type, priority in PRIORITY.items():
                if task_type in active_types:
                    continue
                if task_type == "thumbnail" and item.thumbnail_path:
                    continue
                if task_type == "blip" and item.blip_description:
                    continue
                db.add(Task(task_type=task_type, priority=priority, media_item_id=item.id))
                task_count += 1
        db.commit()
    finally:
        gen.close()

    if task_count > 0:
        await queue_runner.ensure_loop_running(library_name, str(data_root))

    return ImportResponse(accepted=0, skipped=0, task_count=task_count)
