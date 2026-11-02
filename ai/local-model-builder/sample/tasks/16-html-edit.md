---
title: Edit and delete forms
writes: [shelf/app.py]
reads: [shelf/templates/item.html, shelf/models.py, shelf/repo.py]
test: tests/test_16_html_edit.py
---
In `shelf/app.py` (keep the existing routes):

- `POST /items/{item_id}/edit`: 404 if the item doesn't exist. Read the form the same way as `POST /items`, build an
  `ItemUpdate` from the fields present (empty `rating` → `None`, which clears it; `tags` split on commas), update,
  and redirect 303 to `/items/{item_id}`. On a `ValidationError`, re-render item.html with status 400 and an `error`
  naming the failing fields.
- `POST /items/{item_id}/delete`: delete and redirect 303 to `/`; 404 if it doesn't exist.
