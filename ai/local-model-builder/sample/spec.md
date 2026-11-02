# shelf — a small media tracker

A single-user web app to track books, films, games and albums: what you plan to read/watch/play, what you're on,
what you finished, with a rating, notes and tags. Python 3.13, FastAPI, Jinja2 templates, SQLite through the
standard library's `sqlite3`, pydantic v2. No other dependencies. No JavaScript.

## Layout

```
shelf/
  __init__.py        (empty)
  db.py              connect() and init_db()
  models.py          pydantic models and enums
  tags.py            tag normalisation and storage
  repo.py            item CRUD and listing
  stats.py           counts and averages
  csvio.py           CSV export and import
  app.py             create_app(): JSON API under /api and HTML pages
  templates/         Jinja2 templates for the HTML pages
tests/               pytest tests, one file per task (never edit these)
```

Every module imports what it needs from the others with absolute imports, e.g. `from shelf.db import connect`.

## Data

Table `items`:

| column | type | notes |
|---|---|---|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | |
| title | TEXT NOT NULL | |
| kind | TEXT NOT NULL | one of `book`, `film`, `game`, `album` |
| status | TEXT NOT NULL | one of `planned`, `active`, `done`, `dropped` |
| rating | INTEGER | NULL, or 1–5 |
| notes | TEXT NOT NULL DEFAULT '' | |
| created_at | TEXT NOT NULL | UTC, ISO 8601 with seconds, e.g. `2026-11-02T21:30:05+00:00` |
| updated_at | TEXT NOT NULL | same format; equals created_at on insert |

Table `item_tags`: `item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE`, `tag TEXT NOT NULL`,
`PRIMARY KEY (item_id, tag)`.

Timestamps come from `datetime.now(timezone.utc).isoformat(timespec="seconds")`.

## Models (`shelf/models.py`)

- `Kind` and `Status`: `str` enums (`class Kind(str, Enum)`) with the values above.
- `ItemCreate`: `title: str` (whitespace stripped; 1–200 characters after stripping), `kind: Kind`,
  `status: Status = Status.planned`, `rating: int | None = None` (1–5), `notes: str = ""`, `tags: list[str] = []`.
- `ItemUpdate`: every field of ItemCreate optional, default `None` (only fields that are set are changed). Same
  validation as ItemCreate for the fields that are given.
- `Item`: `id: int`, `title: str`, `kind: Kind`, `status: Status`, `rating: int | None`, `notes: str`,
  `tags: list[str]`, `created_at: str`, `updated_at: str`.

Invalid input raises pydantic's `ValidationError`.

## Tags

A tag is normalised by stripping whitespace, lower-casing, and replacing every run of whitespace inside it with a
single `-`. Tags that are empty after normalisation are dropped. An item's tags are unique and always returned
sorted alphabetically.

## Behaviour

- Listing returns newest first: `created_at` descending, then `id` descending.
- Text search (`q`) is a case-insensitive substring match on title or notes.
- Deleting an item deletes its tags (the foreign key cascades; `connect()` turns foreign keys on).

## Web

- JSON API under `/api` (items, tags, stats, CSV).
- HTML pages: `/` (list with filters and a create form), `/items/{id}` (detail with an edit form and a delete
  button). Forms post back and redirect with status 303.
- `create_app(db_path)` builds the app; every request opens its own connection with `connect(db_path)` and closes
  it afterwards. `create_app` calls `init_db` once at startup.

## JSON API (`shelf/app.py`)

| method, path | body / query | response |
|---|---|---|
| `POST /api/items` | ItemCreate JSON | 201, the Item |
| `GET /api/items` | query `status`, `kind`, `q`, `tag` (all optional) | 200, list of Items |
| `GET /api/items/{id}` | | 200 Item; 404 `{"detail": "not found"}` |
| `PATCH /api/items/{id}` | ItemUpdate JSON | 200 Item; 404 as above |
| `DELETE /api/items/{id}` | | 204 with an empty body; 404 as above |
| `GET /api/tags` | | 200, `[{"tag": "...", "count": n}, ...]`, most used first, then alphabetical |
| `GET /api/stats` | | 200, the dict from `shelf.stats.stats()` |
| `GET /api/export.csv` | | 200, `text/csv`, the CSV below |
| `POST /api/import` | raw CSV text as the request body | 200 `{"imported": n}`; 400 `{"detail": "row N: ..."}` |

Invalid JSON bodies get FastAPI's default 422.

## CSV

Header `title,kind,status,rating,notes,tags,created_at`, one row per item in id order, `\n` line endings
(`csv.writer(..., lineterminator="\n")`). `rating` is empty when there is none; `tags` are joined with `;`.
Import reads the same columns: `title` and `kind` are required, `status`/`rating`/`notes`/`tags` optional,
`created_at` is ignored (imported items get new timestamps). Blank rows are skipped. If any row is invalid, nothing
is imported and `ValueError("row N: <reason>")` is raised, N being the line number in the file (the header is
line 1).

## HTML forms

`python-multipart` is **not** installed, so FastAPI's `Form(...)` can't be used. Read form posts with
`urllib.parse.parse_qs((await request.body()).decode(), keep_blank_values=True)`. Form fields: `title`, `kind`,
`status`, `rating` (empty means no rating), `notes`, `tags` (comma separated). Templates are rendered with
`fastapi.templating.Jinja2Templates(directory=<shelf/templates>)` and
`templates.TemplateResponse(request, "<name>.html", context, status_code=...)`.
