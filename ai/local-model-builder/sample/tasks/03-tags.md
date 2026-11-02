---
title: Tag normalisation and storage
writes: [shelf/tags.py]
reads: [shelf/db.py]
test: tests/test_03_tags.py
---
Create `shelf/tags.py` with:

- `normalize_tag(tag: str) -> str`: as in the spec (strip, lower-case, every run of whitespace inside becomes `-`).
- `set_tags(conn, item_id: int, tags: list[str]) -> None`: replace the item's rows in `item_tags` with the
  normalised, de-duplicated, non-empty tags. Do **not** commit (callers commit).
- `get_tags(conn, item_id: int) -> list[str]`: the item's tags, sorted.
- `all_tags(conn) -> list[tuple[str, int]]`: every tag in use with the number of items carrying it, ordered by count
  descending, then tag ascending.
