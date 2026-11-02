---
title: Item detail page
writes: [shelf/templates/item.html, shelf/app.py]
reads: [shelf/templates/base.html, shelf/models.py, shelf/repo.py]
test: tests/test_15_html_detail.py
---
Add the detail page.

- `shelf/templates/item.html` (extends base.html): `{% block title %}{{ item.title }} - shelf{% endblock %}`; the
  title, kind, status, rating, tags and notes; an edit form `method="post" action="/items/{{ item.id }}/edit"` with
  the fields pre-filled (`title`, `kind`, `status`, `rating`, `tags` comma separated, `notes`); and a delete form
  `method="post" action="/items/{{ item.id }}/delete"` with one button.
- In `shelf/app.py` (keep the existing routes): `GET /items/{item_id}` rendering item.html, 404 if missing.
