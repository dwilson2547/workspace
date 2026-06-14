# backend/tests/test_blip.py
# Note: downloads blip2-opt-2.7b (~5.5GB) on first run
# Skip in normal runs: pytest -m "not slow"
import pytest
from pathlib import Path
from PIL import Image
from sqlalchemy import select
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
    try:
        item = MediaItem(file_path=str(img_path), file_name="test.jpg", media_type="image")
        db.add(item)
        db.flush()
        task = Task(task_type="blip", priority=4, media_item_id=item.id)
        db.add(task)
        db.commit()
        task_id, item_id = task.id, item.id
    finally:
        gen.close()

    run_blip_task(task_id, "blip", item_id, "test_lib", str(tmp_path))

    gen2 = get_library_session("test_lib")
    db2 = next(gen2)
    try:
        updated = db2.scalar(select(MediaItem).where(MediaItem.id == item_id))
        assert updated.blip_description is not None
        assert len(updated.blip_description) > 0
    finally:
        gen2.close()
