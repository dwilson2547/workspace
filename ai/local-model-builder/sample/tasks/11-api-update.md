---
title: Item update and delete API
writes: [shelf/app.py]
reads: [shelf/models.py, shelf/repo.py]
test: tests/test_11_api_update.py
---
Add to `create_app` in `shelf/app.py` (keep the existing routes):

- `PATCH /api/items/{item_id}` with an `ItemUpdate` body: the updated item, or 404 `not found`.
- `DELETE /api/items/{item_id}`: 204 with an empty body (`Response(status_code=204)`), or 404 `not found`.
