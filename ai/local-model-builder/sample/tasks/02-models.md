---
title: Pydantic models and enums
writes: [shelf/models.py]
reads: []
test: tests/test_02_models.py
---
Create `shelf/models.py` with the `Kind` and `Status` enums and the `ItemCreate`, `ItemUpdate` and `Item` models
described in the spec, using pydantic v2.

- Title: strip whitespace, then require 1–200 characters (raise `ValueError` in a `field_validator`, which pydantic
  turns into a `ValidationError`). In `ItemUpdate` the title may be `None` (not given); validate it only when given.
- Rating: 1–5 when given (`Field(default=None, ge=1, le=5)`).
- `ItemUpdate` fields all default to `None`, so `model_dump(exclude_unset=True)` returns only the fields the caller set.
