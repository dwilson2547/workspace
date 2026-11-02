---
title: Update and delete items
writes: [shelf/repo.py]
reads: [shelf/models.py, shelf/tags.py]
test: tests/test_06_repo_update.py
---
Add to `shelf/repo.py` (keep everything already there):

- `update_item(conn, item_id: int, data: ItemUpdate) -> Item | None`: `None` if there's no such item. Otherwise change
  only the fields that were set (`data.model_dump(exclude_unset=True)`), set `updated_at` to now, replace the tags if
  `tags` was set, commit, and return the updated `Item`. A field explicitly set to `None` (e.g. `rating=None`) is
  stored as NULL.
- `delete_item(conn, item_id: int) -> bool`: delete it (its tags go with it through the cascade), commit, and return
  whether a row was deleted.
