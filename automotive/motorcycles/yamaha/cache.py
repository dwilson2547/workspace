"""Local lz4-compressed file cache, keyed by URL."""

import hashlib
from pathlib import Path

import lz4.frame

from config import CACHE_DIR


def _cache_path(url: str) -> Path:
    key = hashlib.sha256(url.encode()).hexdigest()
    return CACHE_DIR / key[:2] / key


def get(url: str) -> str | None:
    path = _cache_path(url)
    if not path.exists():
        return None
    try:
        return lz4.frame.decompress(path.read_bytes()).decode("utf-8")
    except Exception:
        return None


def store(url: str, content: str) -> None:
    path = _cache_path(url)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(lz4.frame.compress(content.encode("utf-8")))
