from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pathlib import Path
from typing import Generator
from db.models_library import LibraryBase


_engines: dict[str, object] = {}
_sessions: dict[str, sessionmaker] = {}


class LibraryNotInitializedError(Exception):
    def __init__(self, library_name: str):
        super().__init__(f"Library '{library_name}' not initialized")
        self.library_name = library_name


def get_library_db_path(data_root: Path, library_name: str) -> Path:
    lib_dir = data_root / library_name
    lib_dir.mkdir(parents=True, exist_ok=True)
    return lib_dir / "library.db"


def init_library_db(data_root: Path, library_name: str) -> None:
    db_path = get_library_db_path(data_root, library_name)
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    LibraryBase.metadata.create_all(engine)
    _engines[library_name] = engine
    _sessions[library_name] = sessionmaker(engine)


def get_library_session(library_name: str) -> Generator[Session, None, None]:
    if library_name not in _sessions:
        raise LibraryNotInitializedError(library_name)
    db = _sessions[library_name]()
    try:
        yield db
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()
