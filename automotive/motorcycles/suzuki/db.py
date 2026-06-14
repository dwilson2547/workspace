"""
SQLAlchemy ORM models for the Suzuki parts scraper.

Schema mirrors the parts_interchange project layout:

  Motorcycle ──< motorcycle_diagrams >── Diagram ──< DiagramPart >── Part
  Motorcycle ──< motorcycle_parts    >── Part
  Diagram    ──> Image        (content-addressed via imgcache content_hash)
  Diagram    ──> PartCategory (section name e.g. "Air Cleaner", "Battery")
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
    """
    A specific Suzuki motorcycle variant identified by model code and year.
    e.g. year="2024", model_code="DR-Z50M4", model_name="2024 Suzuki DR-Z50M4"
    """

    __tablename__ = "motorcycle"
    __table_args__ = (
        UniqueConstraint("year", "model_code", name="uq_motorcycle_year_code"),
        Index("idx_motorcycle_model_code", "model_code"),
        Index("idx_motorcycle_year",       "year"),
    )

    id           = Column(Integer,     primary_key=True)
    year         = Column(String(20),  nullable=False)    # "2024"
    model_code   = Column(String(100), nullable=False)    # "DR-Z50M4"
    model_name   = Column(String(300))                    # "2024 Suzuki DR-Z50M4"
    external_id  = Column(String(100))                    # hex ID from URL path
    source_url   = Column(Text)                           # model listing page URL
    scraped_at   = Column(DateTime)                       # set when all diagrams done
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    diagrams = relationship("Diagram", secondary=motorcycle_diagrams, back_populates="motorcycles")
    parts    = relationship("Part",    secondary=motorcycle_parts,    back_populates="motorcycles")


class PartCategory(Base):
    """Top-level part section (e.g. "Air Cleaner", "Battery", "Frame")."""

    __tablename__ = "part_category"

    id   = Column(Integer,     primary_key=True)
    name = Column(String(200), nullable=False, unique=True)

    diagrams = relationship("Diagram", back_populates="category")


class Image(Base):
    """
    Diagram image — stored once per unique imgcache content_hash.
    Multiple diagrams that share the same image point to the same row.
    """

    __tablename__ = "image"
    __table_args__ = (
        UniqueConstraint("content_hash", name="uq_image_content_hash"),
    )

    id           = Column(Integer,     primary_key=True)
    content_hash = Column(String(64),  nullable=False)   # SHA-256 from imgcache
    source_url   = Column(Text)                          # original image URL
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    diagrams = relationship("Diagram", back_populates="image")


class Diagram(Base):
    """
    One parts-diagram page for a specific vehicle section.
    e.g. "Air Cleaner" for 2024 DR-Z50M4
    """

    __tablename__ = "diagram"
    __table_args__ = (
        UniqueConstraint("source_url", name="uq_diagram_url"),
        Index("idx_diagram_external_id", "external_id"),
    )

    id          = Column(Integer, primary_key=True)
    external_id = Column(String(100))                       # hex ID from URL path
    title       = Column(String(300))                       # "Air Cleaner"
    category_id = Column(Integer, ForeignKey("part_category.id"))
    image_id    = Column(Integer, ForeignKey("image.id"), nullable=True)
    source_url  = Column(Text)
    scraped_at  = Column(DateTime)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    category    = relationship("PartCategory", back_populates="diagrams")
    image       = relationship("Image",        back_populates="diagrams")
    parts       = relationship("DiagramPart",  back_populates="diagram", cascade="all, delete-orphan")
    motorcycles = relationship("Motorcycle",   secondary=motorcycle_diagrams, back_populates="diagrams")


class DiagramPart(Base):
    """
    Maps a Part to a Diagram with its reference number and quantity.
    ref_num is the callout number printed on the diagram image (e.g. "1", "2", "15A").
    """

    __tablename__ = "diagram_part"

    diagram_id = Column(Integer, ForeignKey("diagram.id"), primary_key=True)
    part_id    = Column(Integer, ForeignKey("part.id"),    primary_key=True)
    ref_num    = Column(String(25))    # callout number on the diagram image
    quantity   = Column(Integer, default=1)

    diagram = relationship("Diagram", back_populates="parts")
    part    = relationship("Part",    back_populates="diagrams")


class Part(Base):
    """A globally unique Suzuki OEM part, keyed by its part number (SKU)."""

    __tablename__ = "part"
    __table_args__ = (
        Index("idx_part_number", "part_number"),
    )

    id          = Column(Integer,     primary_key=True)
    part_number = Column(String(100), nullable=False, unique=True)  # e.g. "13700-14H01"
    name        = Column(String(300))                                # e.g. "CLEANER ASSY,AIR"
    price       = Column(String(20))                                 # e.g. "$128.06"
    part_url    = Column(Text)                                       # detail page URL
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    diagrams    = relationship("DiagramPart", back_populates="part")
    motorcycles = relationship("Motorcycle",  secondary=motorcycle_parts, back_populates="parts")


# ── Schema initialisation ─────────────────────────────────────────────────────

def init_db() -> None:
    """Create all tables (safe to call on an existing DB — no-op if already exists)."""
    PART_DATA_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)
