"""
SQLAlchemy ORM models for the Aprilia parts scraper.

Schema is inspired by the parts_interchange project:

  Motorcycle ──< motorcycle_diagrams >── Diagram ──< DiagramPart >── Part
  Motorcycle ──< motorcycle_parts    >── Part
  Diagram    ──> Image   (content-addressed by SHA-256 for dedup)
  Diagram    ──> Category
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column, DateTime, ForeignKey, Index, Integer, String,
    Table, Text, UniqueConstraint, create_engine,
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

from config import DB_PATH, PART_DATA_DIR

# ── Engine & session factory ──────────────────────────────────────────────────

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
    echo=False,
)
SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


# ── Association tables (many-to-many) ─────────────────────────────────────────

motorcycle_diagrams = Table(
    "motorcycle_diagrams",
    Base.metadata,
    Column("motorcycle_id", Integer, ForeignKey("motorcycle.id"), primary_key=True),
    Column("diagram_id",    Integer, ForeignKey("diagram.id"),    primary_key=True),
)

motorcycle_parts = Table(
    "motorcycle_parts",
    Base.metadata,
    Column("motorcycle_id", Integer, ForeignKey("motorcycle.id"), primary_key=True),
    Column("part_id",       Integer, ForeignKey("part.id"),       primary_key=True),
)


# ── Core models ───────────────────────────────────────────────────────────────

class Motorcycle(Base):
    """A specific bike variant: vehicle type / displacement / model / year / trim."""

    __tablename__ = "motorcycle"
    __table_args__ = (
        UniqueConstraint(
            "vehicle_type", "displacement", "model", "year", "trim_id",
            name="uq_motorcycle",
        ),
        Index("idx_motorcycle_model", "model"),
        Index("idx_motorcycle_year",  "year"),
    )

    id           = Column(Integer,     primary_key=True)
    vehicle_type = Column(String(50),  nullable=False)   # Motorcycle / Scooter / QUAD-ATV / Electric
    displacement = Column(String(50),  nullable=False)   # "50", "660", …
    model        = Column(String(100), nullable=False)   # "RS", "TUAREG", …
    year         = Column(Integer,     nullable=False)
    trim_name    = Column(String(200))                   # "RS 50", human-readable
    trim_id      = Column(Integer)                       # numeric ID from URL
    model_id     = Column(Integer)                       # numeric model ID from URL
    source_url   = Column(Text)
    scraped_at   = Column(DateTime)                      # set when all diagrams done
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    diagrams = relationship("Diagram", secondary=motorcycle_diagrams, back_populates="motorcycles")
    parts    = relationship("Part",    secondary=motorcycle_parts,    back_populates="motorcycles")


class Category(Base):
    """Top-level part category (FRAME, ENGINE, etc.)."""

    __tablename__ = "category"

    id   = Column(Integer,     primary_key=True)
    name = Column(String(120), nullable=False, unique=True)

    diagrams = relationship("Diagram", back_populates="category")


class Image(Base):
    """
    Diagram image file, stored once per unique SHA-256 hash.
    Multiple diagrams can reference the same Image record.
    """

    __tablename__ = "image"

    id         = Column(Integer,    primary_key=True)
    sha256     = Column(String(64), nullable=False, unique=True)
    local_path = Column(Text)
    source_url = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    diagrams = relationship("Diagram", back_populates="image")


class Diagram(Base):
    """
    One parts-diagram page (a named sub-section under a category for a trim).
    e.g. "Air box" under FRAME for RS 50 2010 RS-50.
    """

    __tablename__ = "diagram"
    __table_args__ = (
        UniqueConstraint("source_url", name="uq_diagram_url"),
    )

    id          = Column(Integer, primary_key=True)
    title       = Column(String(300))
    category_id = Column(Integer, ForeignKey("category.id"))
    image_id    = Column(Integer, ForeignKey("image.id"), nullable=True)
    source_url  = Column(Text)
    scraped_at  = Column(DateTime)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    category    = relationship("Category",    back_populates="diagrams")
    image       = relationship("Image",       back_populates="diagrams")
    parts       = relationship("DiagramPart", back_populates="diagram", cascade="all, delete-orphan")
    motorcycles = relationship("Motorcycle",  secondary=motorcycle_diagrams, back_populates="diagrams")


class DiagramPart(Base):
    """
    Maps a Part to a Diagram with its position index and default quantity.
    The index is the callout number shown on the diagram image (e.g. "1", "2").
    """

    __tablename__ = "diagram_part"

    diagram_id = Column(Integer, ForeignKey("diagram.id"), primary_key=True)
    part_id    = Column(Integer, ForeignKey("part.id"),    primary_key=True)
    part_index = Column(String(25))   # callout number on the diagram
    quantity   = Column(Integer, default=1)

    diagram = relationship("Diagram", back_populates="parts")
    part    = relationship("Part",    back_populates="diagrams")


class Part(Base):
    """A globally unique Aprilia part, keyed by its OEM part number."""

    __tablename__ = "part"
    __table_args__ = (
        Index("idx_part_number", "part_number"),
    )

    id          = Column(Integer,     primary_key=True)
    part_number = Column(String(200), nullable=False, unique=True)
    name        = Column(String(300))
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    diagrams    = relationship("DiagramPart", back_populates="part")
    motorcycles = relationship("Motorcycle",  secondary=motorcycle_parts, back_populates="parts")


# ── Schema initialisation ─────────────────────────────────────────────────────

def init_db() -> None:
    """Create all tables (safe to call on an existing DB)."""
    PART_DATA_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)
