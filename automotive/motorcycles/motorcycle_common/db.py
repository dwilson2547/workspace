import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .models import Base


def get_engine(url: str | None = None):
    """Engine for the shared motorcycle_parts database (MOTORCYCLE_DATABASE_URL)."""
    database_url = url or os.environ["MOTORCYCLE_DATABASE_URL"]
    return create_engine(database_url)


def init_db(engine) -> None:
    """Create all tables. Safe to call on an existing database (no-op)."""
    Base.metadata.create_all(engine)


def get_session_factory(engine) -> sessionmaker:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)
