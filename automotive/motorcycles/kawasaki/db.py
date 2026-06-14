"""
SQLAlchemy ORM models for the Kawasaki parts scraper.

Schema mirrors the parts_interchange project layout:

  Motorcycle ──< motorcycle_diagrams >── Diagram ──< DiagramPart >── Part
  Motorcycle ──< motorcycle_parts    >── Part
  Diagram    ──> Image        (content-addressed by SHA-256 for deduplication)
  Diagram    ──> PartCategory (top-level group, e.g. "Air Cleaner", "Cowling")
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
    A specific Kawasaki vehicle variant identified by its model code.
    The model code is the key Kawasaki uses in URLs (e.g. "EX400HLF").
    """

    __tablename__ = "motorcycle"
    __table_args__ = (
        UniqueConstraint(
            "year", "model_code",
            name="uq_motorcycle_year_code",
        ),
        Index("idx_motorcycle_model_name", "model_name"),
        Index("idx_motorcycle_year",       "year"),
        Index("idx_motorcycle_category",   "category_name"),
    )

    id            = Column(Integer,     primary_key=True)
    category_id   = Column(Integer,     nullable=False)   # 1=Motorcycle, 2=ATV, 3=SxS, 4=Watercraft
    category_name = Column(String(50),  nullable=False)   # "Motorcycle", "ATV", …
    year          = Column(String(20),  nullable=False)   # "2020" or "2007 and prior"
    model_code    = Column(String(50),  nullable=False)   # "EX400HLF"
    model_name    = Column(String(200))                   # "Ninja® 400"
    source_url    = Column(Text)
    scraped_at    = Column(DateTime)                      # set when all diagrams done
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    diagrams = relationship("Diagram", secondary=motorcycle_diagrams, back_populates="motorcycles")
    parts    = relationship("Part",    secondary=motorcycle_parts,    back_populates="motorcycles")


class PartCategory(Base):
    """Top-level part-diagram category (e.g. "Air Cleaner", "Cowling", "Frame")."""

    __tablename__ = "part_category"

    id   = Column(Integer,     primary_key=True)
    name = Column(String(200), nullable=False, unique=True)

    diagrams = relationship("Diagram", back_populates="category")


class Image(Base):
    """
    Diagram image stored once per unique SHA-256 hash.
    Multiple diagrams that share the same image point to the same row.
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
    One parts-diagram page for a specific vehicle section (e.g. "Cowling" for EX400HLF 2020).
    """

    __tablename__ = "diagram"
    __table_args__ = (
        UniqueConstraint("source_url", name="uq_diagram_url"),
        Index("idx_diagram_external_id", "external_id"),
    )

    id          = Column(Integer, primary_key=True)
    external_id = Column(Integer)                       # numeric ID from URL path
    title       = Column(String(300))                   # "Cowling", "Air Cleaner", …
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
    Maps a Part to a Diagram with its callout reference number and quantity.
    ref_num is the "REF #" column on the Kawasaki parts page (e.g. "11011", "11011A").
    destination and remarks are additional columns from the parts table.
    """

    __tablename__ = "diagram_part"

    diagram_id  = Column(Integer, ForeignKey("diagram.id"), primary_key=True)
    part_id     = Column(Integer, ForeignKey("part.id"),    primary_key=True)
    ref_num     = Column(String(25))    # callout number on the diagram
    quantity    = Column(Integer, default=1)
    destination = Column(String(100))  # optional destination/market field
    remarks     = Column(String(300))  # optional remarks/notes field

    diagram = relationship("Diagram", back_populates="parts")
    part    = relationship("Part",    back_populates="diagrams")


class Part(Base):
    """A globally unique Kawasaki OEM part, keyed by its part number."""

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
    """Create all tables (safe to call on an existing DB — no-op if already created)."""
    PART_DATA_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)
