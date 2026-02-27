from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, Future
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Any
from sqlalchemy import select
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
    def __init__(self, library_name: str, data_root: str, max_ml_workers: int = 2, max_io_workers: int = 4):
        self.library_name = library_name
        self.data_root = data_root
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
        try:
            task = db.scalar(
                select(Task)
                .where(Task.status == "pending")
                .order_by(Task.priority, Task.created_at)
            )
            if not task:
                return

            task.status = "processing"
            task.started_at = datetime.now(timezone.utc)
            db.commit()
            task_id = task.id
            task_type = task.task_type
            media_item_id = task.media_item_id
        finally:
            gen.close()

        worker = self._workers.get(task_type)
        if not worker:
            self._mark_failed(library_name, task_id, f"No worker registered for {task_type}")
            return

        try:
            worker(task_id, task_type, media_item_id, library_name, self.data_root)
            self._mark_completed(library_name, task_id)
        except Exception as e:
            self._mark_failed(library_name, task_id, str(e))

    def _mark_completed(self, library_name: str, task_id: int) -> None:
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

    def _mark_failed(self, library_name: str, task_id: int, error: str) -> None:
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
