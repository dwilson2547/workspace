from pathlib import Path
from PIL import Image
from sqlalchemy import select
from db.library_db import init_library_db, get_library_session
from db.models_library import MediaItem, Task
from tasks.thumbnail import run_thumbnail_task


def make_test_image(path: Path) -> Path:
    img = Image.new("RGB", (1920, 1080), color=(100, 150, 200))
    img.save(path)
    return path


def test_thumbnail_generated(tmp_path):
    lib_name = f"lib_{tmp_path.name}"
    img_path = make_test_image(tmp_path / "test.jpg")

    init_library_db(tmp_path, lib_name)
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        item = MediaItem(file_path=str(img_path), file_name="test.jpg", media_type="image")
        db.add(item)
        db.flush()
        task = Task(task_type="thumbnail", priority=1, media_item_id=item.id)
        db.add(task)
        db.commit()
        task_id = task.id
        item_id = item.id
    finally:
        gen.close()

    run_thumbnail_task(task_id, "thumbnail", item_id, lib_name, str(tmp_path))

    gen2 = get_library_session(lib_name)
    db2 = next(gen2)
    try:
        updated = db2.scalar(select(MediaItem).where(MediaItem.id == item_id))
        assert updated.thumbnail_path is not None
        assert Path(updated.thumbnail_path).exists()
        # Verify it's a valid JPEG
        with Image.open(updated.thumbnail_path) as thumb:
            assert thumb.format == "JPEG"
            assert thumb.size[0] <= 400
            assert thumb.size[1] <= 300
    finally:
        gen2.close()


def test_thumbnail_missing_item_raises(tmp_path):
    lib_name = f"lib2_{tmp_path.name}"
    init_library_db(tmp_path, lib_name)

    try:
        run_thumbnail_task(999, "thumbnail", 9999, lib_name, str(tmp_path))
        assert False, "Expected ValueError"
    except ValueError as e:
        assert "9999" in str(e)
