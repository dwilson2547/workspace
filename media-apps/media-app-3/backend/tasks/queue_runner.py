import asyncio
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
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
_running_libraries: set[str] = set()
_tasks: set[asyncio.Task] = set()  # strong refs so GC doesn't collect running tasks


def register_worker(task_type: str, fn) -> None:
    _workers[task_type] = fn


async def ensure_loop_running(library_name: str, data_root: str) -> None:
    if library_name not in _running_libraries:
        task = asyncio.create_task(run_loop(library_name, data_root))
        _tasks.add(task)
        task.add_done_callback(_tasks.discard)


async def run_loop(library_name: str, data_root: str, poll_interval: float = 1.0) -> None:
    global _running
    _running = True
    _running_libraries.add(library_name)
    loop = asyncio.get_running_loop()
    try:
        while _running:
            return_early = False
            gen = get_library_session(library_name)
            db = next(gen)
            try:
                task = db.scalar(
                    select(Task)
                    .where(Task.status == "pending")
                    .order_by(Task.priority, Task.created_at)
                )
                if not task:
                    return_early = True
                else:
                    task.status = "processing"
                    task.started_at = datetime.now(timezone.utc)
                    db.commit()
                    task_id = task.id
                    task_type = task.task_type
                    media_item_id = task.media_item_id
            finally:
                gen.close()

            if return_early:
                await asyncio.sleep(poll_interval)
                continue

            await broadcast({"type": "task_started", "task_id": task_id, "task_type": task_type, "media_item_id": media_item_id})

            worker = _workers.get(task_type)
            if not worker:
                await _mark_failed(library_name, task_id, f"No worker for {task_type}")
                continue

            pool = _io_pool if task_type in IO_TYPES else _ml_pool
            try:
                await loop.run_in_executor(pool, worker, task_id, task_type, media_item_id, library_name, data_root)
            except Exception as e:
                await _mark_failed(library_name, task_id, str(e))
                await broadcast({"type": "task_failed", "task_id": task_id, "error": str(e)})
            else:
                await _mark_completed(library_name, task_id)
                await broadcast({"type": "task_completed", "task_id": task_id, "task_type": task_type, "media_item_id": media_item_id})
    finally:
        _running_libraries.discard(library_name)


async def _mark_completed(library_name: str, task_id: int) -> None:
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        task = db.scalar(select(Task).where(Task.id == task_id))
        if task:
            task.status = "completed"
            task.completed_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        gen.close()


async def _mark_failed(library_name: str, task_id: int, error: str) -> None:
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        task = db.scalar(select(Task).where(Task.id == task_id))
        if task:
            task.retry_count += 1
            if task.retry_count >= MAX_RETRIES:
                task.status = "failed"
                task.error_message = error
                task.completed_at = datetime.now(timezone.utc)
            else:
                task.status = "pending"
            db.commit()
    finally:
        gen.close()


def stop() -> None:
    global _running
    _running = False
    _running_libraries.clear()
