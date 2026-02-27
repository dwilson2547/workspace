from pathlib import Path
from dataclasses import dataclass

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp", ".heic", ".heif"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".wmv", ".m4v", ".flv", ".webm"}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS


@dataclass
class ScannedFile:
    path: str
    file_name: str
    media_type: str  # 'image' | 'video'


def scan_for_media(paths: list[str]) -> list[ScannedFile]:
    results: list[ScannedFile] = []
    for path_str in paths:
        p = Path(path_str)
        if p.is_file():
            _maybe_add(p, results)
        elif p.is_dir():
            for child in sorted(p.rglob("*")):
                if child.is_file():
                    _maybe_add(child, results)
    return results


def _maybe_add(p: Path, results: list[ScannedFile]) -> None:
    ext = p.suffix.lower()
    if ext in IMAGE_EXTENSIONS:
        results.append(ScannedFile(path=str(p), file_name=p.name, media_type="image"))
    elif ext in VIDEO_EXTENSIONS:
        results.append(ScannedFile(path=str(p), file_name=p.name, media_type="video"))
