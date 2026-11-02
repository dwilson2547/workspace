import pytest


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "shelf.db")


@pytest.fixture
def conn(db_path):
    from shelf.db import connect, init_db
    c = connect(db_path)
    init_db(c)
    yield c
    c.close()


@pytest.fixture
def client(db_path):
    from fastapi.testclient import TestClient
    from shelf.app import create_app
    with TestClient(create_app(db_path)) as c:
        yield c


@pytest.fixture
def make(conn):
    """Create an item through the repo: make("Dune", kind="book", tags=["sf"])."""
    def _make(title, **kw):
        from shelf.models import ItemCreate
        from shelf.repo import create_item
        kw.setdefault("kind", "book")
        return create_item(conn, ItemCreate(title=title, **kw))
    return _make
