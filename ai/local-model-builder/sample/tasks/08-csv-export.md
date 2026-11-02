---
title: CSV export
writes: [shelf/csvio.py]
reads: [shelf/tags.py]
test: tests/test_08_csv_export.py
---
Create `shelf/csvio.py` with `export_csv(conn) -> str`, the CSV described in the spec: header row, then one row per
item in id order, written with `csv.writer(out, lineterminator="\n")` into an `io.StringIO`. Empty string for a
missing rating; tags from `shelf.tags.get_tags` joined with `;`.
