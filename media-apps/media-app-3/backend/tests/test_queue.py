from pathlib import Path
from sqlalchemy import select
from db.library_db import init_library_db, get_library_session
from db.models_library import Task
from tasks.queue import TaskQueue, TaskResult


def make_queue(tmp_path, lib_name=None):
    lib_name = lib_name or f"lib_{tmp_path.name}"
    init_library_db(tmp_path, lib_name)
    return TaskQueue(library_name=lib_name, data_root=str(tmp_path), max_ml_workers=1, max_io_workers=2), lib_name


def test_enqueue_and_drain(tmp_path):
    queue, lib_name = make_queue(tmp_path)
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        task = Task(task_type="thumbnail", priority=1, status="pending")
        db.add(task)
        db.commit()
        task_id = task.id
    finally:
        gen.close()

    def dummy_worker(task_id, task_type, media_item_id, library_name, data_root):
        return TaskResult(task_id=task_id, success=True, data={})

    queue.register_worker("thumbnail", dummy_worker)
    queue.drain_once(lib_name)

    gen2 = get_library_session(lib_name)
    db2 = next(gen2)
    try:
        updated = db2.scalar(select(Task).where(Task.id == task_id))
        assert updated.status == "completed"
    finally:
        gen2.close()


def test_failed_task_retries(tmp_path):
    queue, lib_name = make_queue(tmp_path)
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        task = Task(task_type="thumbnail", priority=1, status="pending")
        db.add(task)
        db.commit()
        task_id = task.id
    finally:
        gen.close()

    def failing_worker(task_id, task_type, media_item_id, library_name, data_root):
        raise RuntimeError("simulated failure")

    queue.register_worker("thumbnail", failing_worker)
    queue.drain_once(lib_name)  # first failure -> retry_count=1, status=pending

    gen2 = get_library_session(lib_name)
    db2 = next(gen2)
    try:
        updated = db2.scalar(select(Task).where(Task.id == task_id))
        assert updated.status == "pending"
        assert updated.retry_count == 1
    finally:
        gen2.close()
