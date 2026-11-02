---
title: List and filter items
writes: [shelf/repo.py]
reads: [shelf/models.py, shelf/tags.py]
test: tests/test_05_repo_list.py
---
Add to `shelf/repo.py` (keep everything already there):

`list_items(conn, status=None, kind=None, q: str | None = None, tag: str | None = None) -> list[Item]`

- `status` and `kind` may be enum members or plain strings; filter on their string value.
- `q`: case-insensitive substring of title or notes.
- `tag`: items carrying that tag, after normalising it with `shelf.tags.normalize_tag`.
- All given filters combine with AND. Order: `created_at` descending, then `id` descending.
