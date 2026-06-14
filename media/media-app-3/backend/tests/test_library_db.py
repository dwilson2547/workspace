from pathlib import Path
from sqlalchemy import select
from db.library_db import init_library_db, get_library_session
from db.models_library import MediaItem


def test_media_items_allow_duplicate_filenames(tmp_path):
    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    try:
        # Two files with same name, different paths — both must be allowed (file_name is NOT unique)
        db.add(MediaItem(file_path="/photos/vacation/img001.jpg", file_name="img001.jpg", media_type="image"))
        db.add(MediaItem(file_path="/downloads/img001.jpg", file_name="img001.jpg", media_type="image"))
        db.commit()

        results = db.scalars(select(MediaItem).where(MediaItem.file_name == "img001.jpg")).all()
        assert len(results) == 2
    finally:
        gen.close()


def test_task_cascade_delete(tmp_path):
    init_library_db(tmp_path, "test_lib2")
    gen = get_library_session("test_lib2")
    db = next(gen)
    try:
        item = MediaItem(file_path="/photos/a.jpg", file_name="a.jpg", media_type="image")
        db.add(item)
        db.commit()
        db.refresh(item)

        from db.models_library import Task as LibTask
        task = LibTask(task_type="thumbnail", media_item_id=item.id)
        db.add(task)
        db.commit()

        db.delete(item)
        db.commit()

        remaining = db.scalars(select(LibTask)).all()
        assert len(remaining) == 0  # cascade delete removed the task
    finally:
        gen.close()
