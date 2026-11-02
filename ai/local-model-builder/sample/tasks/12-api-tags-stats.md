---
title: Tags and stats API
writes: [shelf/app.py]
reads: [shelf/tags.py, shelf/stats.py]
test: tests/test_12_api_tags_stats.py
---
Add to `create_app` in `shelf/app.py` (keep the existing routes):

- `GET /api/tags`: `[{"tag": t, "count": n}, ...]` from `shelf.tags.all_tags`.
- `GET /api/stats`: the dict from `shelf.stats.stats`.
