"""
SQLAlchemy ORM models for the Harley-Davidson parts scraper.

Hierarchy:
    Motorcycle (year + model + trim)
        └── Diagram (assembly diagram, M2M via motorcycle_diagrams)
                └── DiagramPart (ref number + Part)
                        └── Part (part number + description)
"""

from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

from config import DB_PATH

DATABASE_URL = f"sqlite:///{DB_PATH}"


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Association / junction tables
# ---------------------------------------------------------------------------

motorcycle_diagrams = Table(
    "motorcycle_diagrams",
    Base.metadata,
    Column("motorcycle_id", Integer, ForeignKey("motorcycles.id"), primary_key=True),
    Column("diagram_id", Integer, ForeignKey("diagrams.id"), primary_key=True),
)

motorcycle_parts = Table(
    "motorcycle_parts",
    Base.metadata,
    Column("motorcycle_id", Integer, ForeignKey("motorcycles.id"), primary_key=True),
    Column("part_id", Integer, ForeignKey("parts.id"), primary_key=True),
)


# ---------------------------------------------------------------------------
# Core entities
# ---------------------------------------------------------------------------

class Motorcycle(Base):
    __tablename__ = "motorcycles"
    __table_args__ = (
        UniqueConstraint("year", "model_code", "trim_code", name="uq_motorcycle_year_model_trim"),
    )

    id = Column(Integer, primary_key=True)
    year = Column(String(4), nullable=False)
    make = Column(String(64), nullable=False, default="Harley-Davidson")
    model_category = Column(String(128), nullable=True)   # top-level folder (e.g. "SOFTAIL")
    model_code = Column(String(32), nullable=False)       # e.g. "FLFBS"
    trim_code = Column(String(32), nullable=False)        # e.g. "1YGK"
    model_name = Column(String(256), nullable=False)      # e.g. "FAT BOY 114"
    full_name = Column(String(512), nullable=True)        # raw label from API
    aria_code = Column(String(256), nullable=True)        # ARI aria identifier
    source_url = Column(Text, nullable=True)
    scraped_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    diagrams = relationship("Diagram", secondary=motorcycle_diagrams, back_populates="motorcycles")
    parts = relationship("Part", secondary=motorcycle_parts, back_populates="motorcycles")


class Diagram(Base):
    __tablename__ = "diagrams"
    __table_args__ = (
        UniqueConstraint("aria_code", name="uq_diagram_aria"),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String(512), nullable=False)
    aria_code = Column(String(256), nullable=True)
    slug = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    image_content_hash = Column(String(128), nullable=True)   # hash stored in imgcache
    scraped_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    motorcycles = relationship("Motorcycle", secondary=motorcycle_diagrams, back_populates="diagrams")
    diagram_parts = relationship("DiagramPart", back_populates="diagram", cascade="all, delete-orphan")


class Part(Base):
    __tablename__ = "parts"
    __table_args__ = (
        UniqueConstraint("part_number", name="uq_part_number"),
    )

    id = Column(Integer, primary_key=True)
    part_number = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    ari_part_id = Column(String(128), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    motorcycles = relationship("Motorcycle", secondary=motorcycle_parts, back_populates="parts")
    diagram_parts = relationship("DiagramPart", back_populates="part")


class DiagramPart(Base):
    """Maps a part to a diagram with ref number / price context."""
    __tablename__ = "diagram_parts"
    __table_args__ = (
        UniqueConstraint("diagram_id", "part_id", "ref_number", name="uq_diagram_part_ref"),
    )

    id = Column(Integer, primary_key=True)
    diagram_id = Column(Integer, ForeignKey("diagrams.id"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=False)
    ref_number = Column(String(32), nullable=True)
    price = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    diagram = relationship("Diagram", back_populates="diagram_parts")
    part = relationship("Part", back_populates="diagram_parts")


# ---------------------------------------------------------------------------
# Engine / session factory
# ---------------------------------------------------------------------------

engine = create_engine(DATABASE_URL, echo=False)
SessionFactory = sessionmaker(bind=engine)


def init_db():
    """Create all tables."""
    Base.metadata.create_all(engine)
