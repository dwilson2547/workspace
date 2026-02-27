from pathlib import Path
from PIL import Image
import cv2
from sqlalchemy import select
from db.library_db import get_library_session
from db.models_library import MediaItem

THUMB_SIZE = (400, 300)


def run_thumbnail_task(task_id: int, task_type: str, media_item_id: int, library_name: str, data_root: str) -> None:
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        item = db.scalar(select(MediaItem).where(MediaItem.id == media_item_id))
        if not item:
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
    finally:
        gen.close()


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
