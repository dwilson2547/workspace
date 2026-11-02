---
title: Statistics
writes: [shelf/stats.py]
reads: [shelf/models.py]
test: tests/test_07_stats.py
---
Create `shelf/stats.py` with `stats(conn) -> dict`:

```
{"total": <number of items>,
 "by_status": {"planned": n, "active": n, "done": n, "dropped": n},   # every status, zeros included, in enum order
 "by_kind": {"book": n, "film": n, "game": n, "album": n},             # every kind, zeros included, in enum order
 "avg_rating": <average of the non-NULL ratings, rounded to 2 decimals, or None if there are none>}
```
