from datetime import datetime

from sqlalchemy import (
    Column, DateTime, ForeignKey, Integer, String, Table, UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, relationship, Session

from config import DB_PATH


class Base(DeclarativeBase):
    pass


# Many-to-many: motorcycles <-> diagrams
motorcycle_diagrams = Table(
    "motorcycle_diagrams",
    Base.metadata,
    Column("motorcycle_id", Integer, ForeignKey("motorcycles.id"), primary_key=True),
    Column("diagram_id", Integer, ForeignKey("diagrams.id"), primary_key=True),
)

# Many-to-many: motorcycles <-> parts (direct, for quick lookup)
motorcycle_parts = Table(
    "motorcycle_parts",
    Base.metadata,
    Column("motorcycle_id", Integer, ForeignKey("motorcycles.id"), primary_key=True),
    Column("part_id", Integer, ForeignKey("parts.id"), primary_key=True),
)


class Motorcycle(Base):
    __tablename__ = "motorcycles"

    id = Column(Integer, primary_key=True)
    year = Column(String, nullable=False)
    make = Column(String, nullable=False, default="Yamaha")
    model = Column(String, nullable=False)
    model_code = Column(String)           # e.g. "BME31"
    trim_name = Column(String)            # full display name from API
    model_id = Column(String, nullable=False)   # Yamaha model ID
    year_id = Column(String, nullable=False)    # Yamaha year ID
    source_url = Column(String)
    scraped_at = Column(DateTime)

    diagrams = relationship("Diagram", secondary=motorcycle_diagrams, back_populates="motorcycles")
    parts = relationship("Part", secondary=motorcycle_parts, back_populates="motorcycles")

    __table_args__ = (
        UniqueConstraint("model_id", name="uq_motorcycle_model_id"),
    )


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True)
    sha256 = Column(String, nullable=False, unique=True)
    local_path = Column(String, nullable=False)
    source_image_id = Column(String)      # Yamaha image ID

    diagrams = relationship("Diagram", back_populates="image")


class Diagram(Base):
    __tablename__ = "diagrams"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    yamaha_diagram_id = Column(String, nullable=False)   # Yamaha diagram ID
    yamaha_image_id = Column(String)                     # Yamaha image ID for the diagram
    image_id = Column(Integer, ForeignKey("images.id"))
    source_url = Column(String)
    scraped_at = Column(DateTime)

    image = relationship("Image", back_populates="diagrams")
    motorcycles = relationship("Motorcycle", secondary=motorcycle_diagrams, back_populates="diagrams")
    diagram_parts = relationship("DiagramPart", back_populates="diagram")

    __table_args__ = (
        UniqueConstraint("yamaha_diagram_id", name="uq_diagram_yamaha_id"),
    )


class Part(Base):
    __tablename__ = "parts"

    id = Column(Integer, primary_key=True)
    part_number = Column(String, nullable=False, unique=True)
    display_part_number = Column(String)
    name = Column(String, nullable=False)

    motorcycles = relationship("Motorcycle", secondary=motorcycle_parts, back_populates="parts")
    diagram_parts = relationship("DiagramPart", back_populates="part")


class DiagramPart(Base):
    __tablename__ = "diagram_parts"

    id = Column(Integer, primary_key=True)
    diagram_id = Column(Integer, ForeignKey("diagrams.id"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=False)
    part_index = Column(String)    # callout label, e.g. "1", "2a"
    quantity = Column(String)      # qty string from API

    diagram = relationship("Diagram", back_populates="diagram_parts")
    part = relationship("Part", back_populates="diagram_parts")

    __table_args__ = (
        UniqueConstraint("diagram_id", "part_id", "part_index", name="uq_diagram_part"),
    )


def get_engine():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{DB_PATH}", echo=False)


def init_db(engine=None):
    if engine is None:
        engine = get_engine()
    Base.metadata.create_all(engine)
    return engine


def get_session(engine=None) -> Session:
    if engine is None:
        engine = get_engine()
    return Session(engine)
