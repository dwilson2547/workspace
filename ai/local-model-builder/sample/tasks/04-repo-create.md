---
title: Create and get items
writes: [shelf/repo.py]
reads: [shelf/db.py, shelf/models.py, shelf/tags.py]
test: tests/test_04_repo_create.py
---
Create `shelf/repo.py` with:

- `create_item(conn, data: ItemCreate) -> Item`: insert the row (created_at = updated_at = now, format in the spec),
  store the tags with `shelf.tags.set_tags`, commit, and return the stored item as an `Item`.
- `get_item(conn, item_id: int) -> Item | None`: the item with its tags (from `shelf.tags.get_tags`), or `None`.

Store enum values as their string value (`data.kind.value`). Put the row-to-`Item` conversion in a helper; later tasks
reuse it.
