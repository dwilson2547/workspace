from enum import Enum

from pydantic import BaseModel, Field, field_validator


class Kind(str, Enum):
    book = "book"
    film = "film"
    game = "game"
    album = "album"


class Status(str, Enum):
    planned = "planned"
    active = "active"
    done = "done"
    dropped = "dropped"


def _title(v):
    if v is None:
        return v
    v = v.strip()
    if not 1 <= len(v) <= 200:
        raise ValueError("title must be 1-200 characters")
    return v


class ItemCreate(BaseModel):
    title: str
    kind: Kind
    status: Status = Status.planned
    rating: int | None = Field(default=None, ge=1, le=5)
    notes: str = ""
    tags: list[str] = []

    _t = field_validator("title")(_title)


class ItemUpdate(BaseModel):
    title: str | None = None
    kind: Kind | None = None
    status: Status | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = None
    tags: list[str] | None = None

    _t = field_validator("title")(_title)


class Item(BaseModel):
    id: int
    title: str
    kind: Kind
    status: Status
    rating: int | None
    notes: str
    tags: list[str]
    created_at: str
    updated_at: str
