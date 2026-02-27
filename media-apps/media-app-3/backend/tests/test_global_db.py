import pytest
from pathlib import Path
from db.global_db import init_global_db, get_global_db
from db.models_global import Setting, Library


def test_init_creates_tables(tmp_path):
    init_global_db(tmp_path)
    gen = get_global_db()
    db = next(gen)
    try:
        db.add(Setting(key="data_root", value=str(tmp_path)))
        db.commit()
        result = db.query(Setting).filter_by(key="data_root").first()
        assert result.value == str(tmp_path)
    finally:
        next(gen, None)


def test_library_creation(tmp_path):
    init_global_db(tmp_path)
    gen = get_global_db()
    db = next(gen)
    try:
        lib = Library(name="My Library")
        db.add(lib)
        db.commit()
        db.refresh(lib)
        assert lib.id is not None
        assert lib.name == "My Library"
    finally:
        next(gen, None)
