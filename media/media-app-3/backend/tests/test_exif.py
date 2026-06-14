import pytest
from pathlib import Path
from PIL import Image
import piexif
from sqlalchemy import select
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
    lib_name = f"lib_{tmp_path.name}"
    img_path = make_image_with_exif(tmp_path / "test.jpg")

    init_library_db(tmp_path, lib_name)
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        item = MediaItem(file_path=str(img_path), file_name="test.jpg", media_type="image")
        db.add(item)
        db.flush()
        task = Task(task_type="exif", priority=2, media_item_id=item.id)
        db.add(task)
        db.commit()
        task_id = task.id
        item_id = item.id
    finally:
        gen.close()

    run_exif_task(task_id, "exif", item_id, lib_name, str(tmp_path))

    gen2 = get_library_session(lib_name)
    db2 = next(gen2)
    try:
        updated = db2.scalar(select(MediaItem).where(MediaItem.id == item_id))
        assert updated.exif_data is not None
        assert len(updated.exif_data) > 0
        # EXIF Make tag should be present
        assert any("Make" in k for k in updated.exif_data)
        # captured_at should be parsed from DateTimeOriginal
        assert updated.captured_at is not None
        assert updated.captured_at.year == 2024
        assert updated.captured_at.month == 6
    finally:
        gen2.close()


def test_exif_no_exif_data(tmp_path):
    """Image without EXIF data should store empty dict and leave captured_at as None."""
    lib_name = f"lib2_{tmp_path.name}"
    img_path = tmp_path / "plain.jpg"
    Image.new("RGB", (100, 100)).save(img_path)

    init_library_db(tmp_path, lib_name)
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        item = MediaItem(file_path=str(img_path), file_name="plain.jpg", media_type="image")
        db.add(item)
        db.flush()
        task = Task(task_type="exif", priority=2, media_item_id=item.id)
        db.add(task)
        db.commit()
        task_id = task.id
        item_id = item.id
    finally:
        gen.close()

    run_exif_task(task_id, "exif", item_id, lib_name, str(tmp_path))

    gen2 = get_library_session(lib_name)
    db2 = next(gen2)
    try:
        updated = db2.scalar(select(MediaItem).where(MediaItem.id == item_id))
        assert updated.exif_data == {}
        assert updated.captured_at is None
    finally:
        gen2.close()


def test_exif_video_skips_extraction(tmp_path):
    """Video items should store empty dict (no EXIF extraction for videos)."""
    lib_name = f"lib3_{tmp_path.name}"
    fake_video = tmp_path / "clip.mp4"
    fake_video.write_bytes(b"fake video content")

    init_library_db(tmp_path, lib_name)
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        item = MediaItem(file_path=str(fake_video), file_name="clip.mp4", media_type="video")
        db.add(item)
        db.flush()
        task = Task(task_type="exif", priority=2, media_item_id=item.id)
        db.add(task)
        db.commit()
        task_id = task.id
        item_id = item.id
    finally:
        gen.close()

    run_exif_task(task_id, "exif", item_id, lib_name, str(tmp_path))

    gen2 = get_library_session(lib_name)
    db2 = next(gen2)
    try:
        updated = db2.scalar(select(MediaItem).where(MediaItem.id == item_id))
        assert updated.exif_data == {}
        assert updated.captured_at is None
    finally:
        gen2.close()


def test_exif_item_not_found(tmp_path):
    lib_name = f"lib_nf_{tmp_path.name}"
    init_library_db(tmp_path, lib_name)
    with pytest.raises(ValueError, match="MediaItem 9999 not found"):
        run_exif_task(1, "exif", 9999, lib_name, str(tmp_path))
