---
title: CSV import
writes: [shelf/csvio.py]
reads: [shelf/models.py, shelf/repo.py]
test: tests/test_09_csv_import.py
---
Add to `shelf/csvio.py` (keep `export_csv`): `import_csv(conn, text: str) -> int`, as described in the spec.

- Read with `csv.DictReader`. Skip rows whose values are all blank. Line numbers start at 2 for the first data row.
- Build an `ItemCreate` per row: `title` and `kind` always (missing → empty string, which fails validation);
  `status` and `rating` only when non-blank; `notes` (default ""); `tags` split on `;`, blank ones dropped.
- Validate **every** row before creating any. On the first invalid row raise
  `ValueError(f"row {n}: {reason}")` (reason: the first pydantic error's `msg`) and create nothing.
- Then create each with `shelf.repo.create_item` and return how many were created.
