import pytest
from pydantic import ValidationError

from shelf.models import Item, ItemCreate, ItemUpdate, Kind, Status


def test_enums():
    assert [k.value for k in Kind] == ["book", "film", "game", "album"]
    assert [s.value for s in Status] == ["planned", "active", "done", "dropped"]
    assert Kind("film") == "film"


def test_create_defaults_and_strip():
    m = ItemCreate(title="  Dune  ", kind="book")
    assert m.title == "Dune" and m.status is Status.planned and m.rating is None and m.notes == "" and m.tags == []


@pytest.mark.parametrize("title", ["", "   ", "x" * 201])
def test_bad_titles(title):
    with pytest.raises(ValidationError):
        ItemCreate(title=title, kind="book")


@pytest.mark.parametrize("rating", [0, 6])
def test_bad_rating(rating):
    with pytest.raises(ValidationError):
        ItemCreate(title="a", kind="book", rating=rating)


def test_bad_kind():
    with pytest.raises(ValidationError):
        ItemCreate(title="a", kind="podcast")


def test_update_all_optional_and_validated():
    u = ItemUpdate()
    assert u.model_dump(exclude_unset=True) == {}
    assert ItemUpdate(title=" x ").title == "x"
    with pytest.raises(ValidationError):
        ItemUpdate(rating=9)
    with pytest.raises(ValidationError):
        ItemUpdate(title="  ")


def test_item_fields():
    i = Item(id=1, title="a", kind="game", status="done", rating=None, notes="", tags=["x"],
             created_at="t", updated_at="t")
    assert i.kind is Kind.game and i.status is Status.done
