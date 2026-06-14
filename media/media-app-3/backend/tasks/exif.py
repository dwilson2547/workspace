from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy import select
import exifread
from db.library_db import get_library_session
from db.models_library import MediaItem


def run_exif_task(task_id: int, task_type: str, media_item_id: int, library_name: str, data_root: str) -> None:
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        item = db.scalar(select(MediaItem).where(MediaItem.id == media_item_id))
        if not item:
            raise ValueError(f"MediaItem {media_item_id} not found")

        exif_data = {}
        captured_at = None

        if item.media_type == "image":
            try:
                with open(item.file_path, "rb") as f:
                    tags = exifread.process_file(f, details=False)
                exif_data = {str(k): str(v) for k, v in tags.items()}
                date_str = exif_data.get("EXIF DateTimeOriginal") or exif_data.get("Image DateTime")
                if date_str:
                    try:
                        naive_dt = datetime.strptime(date_str, "%Y:%m:%d %H:%M:%S")
                        captured_at = naive_dt.replace(tzinfo=timezone.utc)
                    except ValueError:
                        pass
            except Exception:
                pass

        item.exif_data = exif_data
        if captured_at:
            item.captured_at = captured_at
        db.commit()
    finally:
        gen.close()
