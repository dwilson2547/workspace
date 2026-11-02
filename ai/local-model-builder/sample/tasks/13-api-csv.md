---
title: CSV export and import API
writes: [shelf/app.py]
reads: [shelf/csvio.py]
test: tests/test_13_api_csv.py
---
Add to `create_app` in `shelf/app.py` (keep the existing routes):

- `GET /api/export.csv`: `PlainTextResponse(export_csv(conn), media_type="text/csv")`.
- `POST /api/import`: the raw request body (`(await request.body()).decode()`) is the CSV; return
  `{"imported": n}`. A `ValueError` from `import_csv` becomes `HTTPException(400, str(error))`.
