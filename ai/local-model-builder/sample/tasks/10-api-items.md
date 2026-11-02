---
title: App factory and item create/list/get API
writes: [shelf/app.py]
reads: [shelf/db.py, shelf/models.py, shelf/repo.py]
test: tests/test_10_api_items.py
---
Create `shelf/app.py` with `create_app(db_path: str) -> FastAPI`.

- At creation, open a connection, run `init_db`, close it.
- Every request opens its own connection with `connect(db_path)` and closes it when done (a small context manager
  helper is fine).
- Routes: `POST /api/items` (201), `GET /api/items` with optional query parameters `status: Status | None`,
  `kind: Kind | None`, `q`, `tag`, and `GET /api/items/{item_id}` (404 with `{"detail": "not found"}` via
  `HTTPException(404, "not found")`). Return `Item` models directly; FastAPI serialises them.
- Request bodies are `ItemCreate`; FastAPI returns 422 for invalid ones by itself.
