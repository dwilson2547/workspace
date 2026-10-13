"""Common schema for the motorcycle parts reference database.

One set of tables serves every OEM scraper (kawasaki, aprilia, yamaha, …), so the
reference DB can answer cross-OEM queries without per-OEM model juggling. OEM
specifics that have no common home go in JSONB `extras` columns rather than new
columns.

Layout (same shape as the parts_interchange project):

  Motorcycle ──< motorcycle_diagrams >── Diagram ──< DiagramPart >── Part
  Motorcycle ──< motorcycle_parts    >── Part
  Diagram    ──> Image        (content-addressed by the imgcache hash)
  Diagram    ──> PartCategory  (top-level group, e.g. "Cowling", "Air Cleaner")

Variant identity: each OEM identifies a bike by a different combination of
selector fields (kawasaki: year+model_code, aprilia: displacement+model+year+
trim, yamaha: model+year+trim). Scrapers compute a `variant_key` — a stable
slug unique within a make — instead of the schema guessing which fields are
mandatory.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ── Association tables (many-to-many) ─────────────────────────────────────────

motorcycle_diagrams = Table(
    "motorcycle_diagrams",
    Base.metadata,
    Column("motorcycle_id", Integer, ForeignKey("motorcycle.id"), primary_key=True),
    Column("diagram_id", Integer, ForeignKey("diagram.id"), primary_key=True),
)

motorcycle_parts = Table(
    "motorcycle_parts",
    Base.metadata,
    Column("motorcycle_id", Integer, ForeignKey("motorcycle.id"), primary_key=True),
    Column("part_id", Integer, ForeignKey("part.id"), primary_key=True),
)


# ── Core models ───────────────────────────────────────────────────────────────

class Motorcycle(Base):
    """A specific vehicle variant, as identified by an OEM parts selector."""

    __tablename__ = "motorcycle"
    __table_args__ = (
        UniqueConstraint("make", "variant_key", name="uq_motorcycle_make_variant"),
        Index("idx_motorcycle_make_year", "make", "year"),
        Index("idx_motorcycle_model_name", "model_name"),
    )

    id           = Column(Integer, primary_key=True)
    make         = Column(String(64), nullable=False)      # "Kawasaki", "Aprilia", …
    vehicle_type = Column(String(50))                      # Motorcycle / ATV / Scooter / …
    year         = Column(String(20), nullable=False)      # "2020" or "2007 and prior"
    model_code   = Column(String(50))                      # OEM code, e.g. "EX400HLF"
    model_name   = Column(String(200))                     # "Ninja 400"
    trim_name    = Column(String(200))                     # OEM trim, when the selector has one
    variant_key  = Column(String(300), nullable=False)     # stable slug unique within a make
    source_url   = Column(Text)
    scraped_at   = Column(DateTime)                        # set when all diagrams done
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    diagrams = relationship("Diagram", secondary=motorcycle_diagrams, back_populates="motorcycles")
    parts     = relationship("Part", secondary=motorcycle_parts, back_populates="motorcycles")


class PartCategory(Base):
    """Top-level part-diagram category (e.g. "Cowling", "Air Cleaner")."""

    __tablename__ = "part_category"

    id   = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False, unique=True)

    diagrams = relationship("Diagram", back_populates="category")


class Image(Base):
    """Diagram image stored once per unique content hash in imgcache."""

    __tablename__ = "image"

    id           = Column(Integer, primary_key=True)
    content_hash = Column(String(128), nullable=False, unique=True)  # imgcache hash
    source_url   = Column(Text)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    diagrams = relationship("Diagram", back_populates="image")


class Diagram(Base):
    """One parts-diagram page for a vehicle section (e.g. "Cowling" for EX400HLF 2020)."""

    __tablename__ = "diagram"
    __table_args__ = (
        UniqueConstraint("source_url", name="uq_diagram_url"),
        Index("idx_diagram_title", "title"),
    )

    id          = Column(Integer, primary_key=True)
    title       = Column(String(300))
    category_id = Column(Integer, ForeignKey("part_category.id"))
    image_id    = Column(Integer, ForeignKey("image.id"), nullable=True)
    source_url  = Column(Text)
    scraped_at  = Column(DateTime)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    category    = relationship("PartCategory", back_populates="diagrams")
    image       = relationship("Image", back_populates="diagrams")
    parts       = relationship("DiagramPart", back_populates="diagram", cascade="all, delete-orphan")
    motorcycles = relationship("Motorcycle", secondary=motorcycle_diagrams, back_populates="diagrams")


class DiagramPart(Base):
    """Maps a Part to a Diagram with its callout reference number and quantity.

    OEM-specific table columns (kawasaki's destination/remarks, etc.) go in
    `extras` rather than dedicated columns.
    """

    __tablename__ = "diagram_part"

    diagram_id = Column(Integer, ForeignKey("diagram.id"), primary_key=True)
    part_id    = Column(Integer, ForeignKey("part.id"), primary_key=True)
    ref_num    = Column(String(25))      # callout number on the diagram
    quantity   = Column(Integer)         # OEM-reported quantity, when numeric
    extras     = Column(JSON)            # OEM-specific fields

    diagram = relationship("Diagram", back_populates="parts")
    part    = relationship("Part", back_populates="diagrams")


class Part(Base):
    """A globally unique OEM part, keyed by (make, part_number)."""

    __tablename__ = "part"
    __table_args__ = (
        UniqueConstraint("make", "part_number", name="uq_part_make_number"),
        Index("idx_part_number", "part_number"),
    )

    id          = Column(Integer, primary_key=True)
    make        = Column(String(64), nullable=False)
    part_number = Column(String(200), nullable=False)
    name        = Column(String(300))
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    diagrams    = relationship("DiagramPart", back_populates="part")
    motorcycles = relationship("Motorcycle", secondary=motorcycle_parts, back_populates="parts")
