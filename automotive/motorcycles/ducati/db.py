"""SQLAlchemy ORM models, engine setup, and session helpers (SQLite)."""

from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

from config import DB_PATH

# ── Engine & session factory ──────────────────────────────────────────────────

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
    echo=False,
)
SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)


# ── Models ────────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


class Catalog(Base):
    __tablename__ = "catalogs"
    __table_args__ = (
        Index("idx_catalogs_year",         "year"),
        Index("idx_catalogs_model_family", "model_family"),
    )

    id              = Column(Integer, primary_key=True)
    year            = Column(Integer, nullable=False)
    model_family    = Column(String(100))
    model_name      = Column(String(200), nullable=False)
    issuu_url       = Column(Text, unique=True, nullable=False)
    local_path           = Column(Text)
    downloaded_at        = Column(DateTime)
    file_size_bytes      = Column(BigInteger)
    parsed_at            = Column(DateTime)
    no_download_btn_at   = Column(DateTime)   # set when Issuu has no Download button
    created_at           = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    subsystems = relationship("Subsystem", back_populates="catalog", cascade="all, delete-orphan")
    parts      = relationship("Part",      back_populates="catalog", cascade="all, delete-orphan")


class Subsystem(Base):
    __tablename__ = "subsystems"

    id          = Column(Integer, primary_key=True)
    catalog_id  = Column(Integer, ForeignKey("catalogs.id"), nullable=False)
    name        = Column(String(200), nullable=False)
    page_number = Column(Integer)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    catalog = relationship("Catalog",   back_populates="subsystems")
    parts   = relationship("Part",      back_populates="subsystem")


class Part(Base):
    __tablename__ = "parts"
    __table_args__ = (
        Index("idx_parts_catalog_id", "catalog_id"),
    )

    id           = Column(Integer, primary_key=True)
    catalog_id   = Column(Integer, ForeignKey("catalogs.id"), nullable=False)
    subsystem_id = Column(Integer, ForeignKey("subsystems.id"))
    ref_number   = Column(String(20))
    part_number  = Column(String(100), nullable=False, index=True)
    description  = Column(Text)
    quantity     = Column(String(20))
    notes        = Column(Text)
    page_number  = Column(Integer)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    catalog   = relationship("Catalog",   back_populates="parts")
    subsystem = relationship("Subsystem", back_populates="parts")


# ── Session helper ────────────────────────────────────────────────────────────

@contextmanager
def get_session():
    """Yield a SQLAlchemy Session; rolls back on exception, always closes."""
    session: Session = SessionFactory()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ── DB helpers ────────────────────────────────────────────────────────────────

def init_db():
    """Create all tables and indexes if they do not yet exist."""
    Base.metadata.create_all(engine)
    print("[db] Schema initialised.")


def upsert_catalog(
    session: Session,
    year: int,
    model_family: str,
    model_name: str,
    issuu_url: str,
) -> int:
    """Insert or update a catalog row; return its id."""
    catalog = session.query(Catalog).filter_by(issuu_url=issuu_url).first()
    if catalog is None:
        catalog = Catalog(
            year=year,
            model_family=model_family,
            model_name=model_name,
            issuu_url=issuu_url,
        )
        session.add(catalog)
    else:
        catalog.year         = year
        catalog.model_family = model_family
        catalog.model_name   = model_name
    session.flush()  # assign PK without committing
    return catalog.id


def mark_downloaded(session: Session, catalog_id: int, local_path: str, file_size: int):
    catalog = session.get(Catalog, catalog_id)
    if catalog:
        catalog.local_path      = local_path
        catalog.downloaded_at   = datetime.now(timezone.utc)
        catalog.file_size_bytes = file_size


def mark_parsed(session: Session, catalog_id: int):
    catalog = session.get(Catalog, catalog_id)
    if catalog:
        catalog.parsed_at = datetime.now(timezone.utc)


def mark_no_download_button(session: Session, catalog_id: int):
    """Record that this Issuu document has no Download button available."""
    catalog = session.get(Catalog, catalog_id)
    if catalog:
        catalog.no_download_btn_at = datetime.now(timezone.utc)


def needs_download(
    session: Session, issuu_url: str, threshold_days: int
) -> tuple[bool, Optional[int]]:
    """Return (should_download, catalog_id).

    Returns False when the row is flagged as having no Download button on Issuu,
    so repeated runs skip it without re-visiting the page.
    """
    catalog = session.query(Catalog).filter_by(issuu_url=issuu_url).first()
    if catalog is None:
        return True, None
    if catalog.no_download_btn_at is not None:
        return False, catalog.id  # already confirmed: no button available
    if catalog.downloaded_at is None:
        return True, catalog.id
    # downloaded_at stored as naive UTC; make it timezone-aware for comparison
    stored = catalog.downloaded_at
    if stored.tzinfo is None:
        stored = stored.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - stored
    return age > timedelta(days=threshold_days), catalog.id
