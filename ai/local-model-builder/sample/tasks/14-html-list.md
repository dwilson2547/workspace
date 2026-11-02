---
title: List page with filters and create form
writes: [shelf/templates/base.html, shelf/templates/list.html, shelf/app.py]
reads: [shelf/models.py, shelf/repo.py]
test: tests/test_14_html_list.py
---
Add the first HTML page.

- `shelf/templates/base.html`: an HTML5 page with `<title>{% block title %}shelf{% endblock %}</title>`, a header
  link to `/`, the error message in a `<p class="error">` when the context has an `error`, and
  `{% block content %}{% endblock %}`.
- `shelf/templates/list.html` (extends base.html): a GET filter form (`status` and `kind` selects with an empty
  "any" option, `q`, `tag`), a table of items whose titles link to `/items/{id}`, and a create form with
  `method="post" action="/items"` and fields `title`, `kind`, `status`, `rating`, `tags`, `notes`.
- In `shelf/app.py` (keep the existing routes): a module-level `Jinja2Templates` for `shelf/templates`;
  `GET /` with query parameters `status`, `kind`, `q`, `tag` (strings, empty meaning no filter) rendering
  list.html; `POST /items` reading the form as the spec says (python-multipart is not installed), building an
  `ItemCreate` (empty `rating` → no rating, `tags` split on commas). On success redirect 303 to `/items/{id}`. On a
  pydantic `ValidationError`, re-render list.html with status 400 and an `error` text that names the failing fields
  (e.g. `title: Value error, ...`).
- Pass the template the lists of kind and status values for the selects. Jinja2 autoescaping is on by default for
  `.html`; keep it on.
