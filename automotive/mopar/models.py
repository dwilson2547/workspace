"""
SQLAlchemy models for the Mopar parts scraper.
Adapted from /home/daniel/documents/workspace/parts_interchange/api/src/models.py
to use standalone SQLAlchemy (no Flask dependency).
"""
from sqlalchemy import (
    Boolean, Column, Float, ForeignKey, Integer, String, Table, Text,
    create_engine, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


# ── Association tables ─────────────────────────────────────────────────────────

car_categories = Table(
    "car_categories",
    Base.metadata,
    Column("car_id", Integer, ForeignKey("car.id"), primary_key=True),
    Column("category_id", Integer, ForeignKey("category.id"), primary_key=True),
)

car_diagrams = Table(
    "car_diagrams",
    Base.metadata,
    Column("car_id", Integer, ForeignKey("car.id"), primary_key=True),
    Column("diagram_id", Integer, ForeignKey("diagram.id"), primary_key=True),
)

car_parts = Table(
    "car_parts",
    Base.metadata,
    Column("car_id", Integer, ForeignKey("car.id"), primary_key=True),
    Column("part_id", Integer, ForeignKey("part.id"), primary_key=True),
)


# ── Join models ────────────────────────────────────────────────────────────────

class PartImages(Base):
    __tablename__ = "part_images"

    part_id = Column(Integer, ForeignKey("part.id"), primary_key=True)
    image_id = Column(Integer, ForeignKey("image.id"), primary_key=True)
    part_image_text = Column(String(500))
    image = relationship("Image", back_populates="parts")
    part = relationship("Part", back_populates="images")


class DiagramParts(Base):
    __tablename__ = "diagram_parts"

    diagram_id = Column(Integer, ForeignKey("diagram.id"), primary_key=True)
    part_id = Column(Integer, ForeignKey("part.id"), primary_key=True)
    part_index = Column(String(25))
    part = relationship("Part", back_populates="diagrams")
    diagram = relationship("Diagram", back_populates="parts")


# ── Core models ────────────────────────────────────────────────────────────────

class Category(Base):
    __tablename__ = "category"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), index=True, unique=True, nullable=False)


class SubCategory(Base):
    __tablename__ = "subcategory"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), index=True, nullable=False)
    category_id = Column(Integer, ForeignKey("category.id"))
    category = relationship("Category", backref="sub_categories")

    __table_args__ = (UniqueConstraint("name", "category_id", name="uq_subcategory_name_cat"),)


class Diagram(Base):
    __tablename__ = "diagram"

    id = Column(Integer, primary_key=True)
    image_id = Column(Integer, ForeignKey("image.id"))
    category_id = Column(Integer, ForeignKey("category.id"))
    sub_category_id = Column(Integer, ForeignKey("subcategory.id"))
    base_car_url = Column(String(1000))
    category_url = Column(String(1000))
    image = relationship("Image")
    parts = relationship("DiagramParts", back_populates="diagram")
    category = relationship("Category")
    sub_category = relationship("SubCategory")


class Image(Base):
    __tablename__ = "image"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), index=True)
    bucket_path = Column(String(120))
    url = Column(String(500), unique=True)
    alt_text = Column(String(500))
    saved = Column(Boolean, default=False)
    uploaded = Column(Boolean, default=False)
    manufacturer_id = Column(Integer, ForeignKey("manufacturer.id"))
    parts = relationship("PartImages", back_populates="image")
    manufacturer = relationship("Manufacturer")


class Manufacturer(Base):
    __tablename__ = "manufacturer"

    id = Column(Integer, primary_key=True)
    name = Column(String(300), index=True, unique=True, nullable=False)
    base_url = Column(String(300))
    parts = relationship("Part", backref="manufacturer", lazy=True)


class Part(Base):
    __tablename__ = "part"

    id = Column(Integer, primary_key=True)
    url = Column(String(500), unique=True)
    part_number = Column(String(200), index=True, unique=True)
    manufacturer_id = Column(Integer, ForeignKey("manufacturer.id"))
    title = Column(String(200))
    category_id = Column(Integer, ForeignKey("category.id"))
    other_names = Column(Text)
    description = Column(Text)
    replaces = Column(Text)
    positions = Column(Text)
    notes = Column(Text)
    msrp = Column(Float)
    applications = Column(Text)
    hazmat = Column(Boolean)
    diagrams = relationship("DiagramParts", back_populates="part")
    images = relationship("PartImages", back_populates="part")
    cars = relationship("Car", secondary=car_parts, back_populates="parts")


# ── Vehicle models ─────────────────────────────────────────────────────────────

class Year(Base):
    __tablename__ = "year"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), index=True, unique=True)


class Make(Base):
    __tablename__ = "make"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), index=True, unique=True)
    select_value = Column(String(120))
    start_year = Column(Integer)
    end_year = Column(Integer)
    models = relationship("Model", backref="make", lazy=True)


class Model(Base):
    __tablename__ = "model"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), index=True)
    select_value = Column(String(120))
    make_id = Column(Integer, ForeignKey("make.id"))

    __table_args__ = (UniqueConstraint("name", "make_id", name="uq_model_name_make"),)


class Trim(Base):
    __tablename__ = "trim"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), index=True, unique=True)
    select_value = Column(String(120))


class Engine(Base):
    __tablename__ = "engine"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), index=True, unique=True)
    select_value = Column(String(120))


class Car(Base):
    __tablename__ = "car"

    id = Column(Integer, primary_key=True)
    year_id = Column(Integer, ForeignKey("year.id"))
    make_id = Column(Integer, ForeignKey("make.id"))
    model_id = Column(Integer, ForeignKey("model.id"))
    trim_id = Column(Integer, ForeignKey("trim.id"))
    engine_id = Column(Integer, ForeignKey("engine.id"))
    manufacturer_id = Column(Integer, ForeignKey("manufacturer.id"))
    car_id = Column(String(200))
    vehicle_id = Column(String(200), unique=True)
    base_url = Column(String(1000))

    year = relationship("Year", backref="cars", lazy=True)
    make = relationship("Make", backref="cars", lazy=True)
    model = relationship("Model", backref="cars", lazy=True)
    trim = relationship("Trim", backref="cars", lazy=True)
    engine = relationship("Engine", backref="cars", lazy=True)
    parts = relationship("Part", secondary=car_parts, back_populates="cars")


def init_db(db_path: str = "mopar_parts.db") -> object:
    """Create all tables and return the engine."""
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    Base.metadata.create_all(engine)
    return engine
