from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pathlib import Path
from typing import Generator


_engine = None
_SessionLocal = None


def init_global_db(data_root: Path) -> None:
    global _engine, _SessionLocal
    data_root.mkdir(parents=True, exist_ok=True)
    db_path = data_root / "settings.db"
    _engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    _SessionLocal = sessionmaker(_engine)
    from db.models_global import GlobalBase
    GlobalBase.metadata.create_all(_engine)


def get_global_db() -> Generator[Session, None, None]:
    assert _SessionLocal is not None, "Global DB not initialized"
    db = _SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
