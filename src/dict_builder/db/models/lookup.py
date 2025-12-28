# Path: src/dict_builder/db/models/lookup.py
import json
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base

class Lookup(Base):
    __tablename__ = "lookup"

    lookup_key: Mapped[str] = mapped_column(primary_key=True)
    headwords: Mapped[str] = mapped_column(default="")
    roots: Mapped[str] = mapped_column(default="")
    deconstructor: Mapped[str] = mapped_column(default="")
    variant: Mapped[str] = mapped_column(default="")
    spelling: Mapped[str] = mapped_column(default="")
    grammar: Mapped[str] = mapped_column(default="")
    help: Mapped[str] = mapped_column(default="")
    abbrev: Mapped[str] = mapped_column(default="")
    epd: Mapped[str] = mapped_column(default="")
    rpd: Mapped[str] = mapped_column(default="")
    other: Mapped[str] = mapped_column(default="")
    sinhala: Mapped[str] = mapped_column(default="")
    devanagari: Mapped[str] = mapped_column(default="")
    thai: Mapped[str] = mapped_column(default="")

    # Helpers properties to unpack JSON
    @property
    def deconstructor_unpack_list(self):
        """Giải nén chuỗi JSON trong cột deconstructor thành list python"""
        if self.deconstructor:
            try:
                return json.loads(self.deconstructor)
            except json.JSONDecodeError:
                return []
        return []

    @property
    def grammar_unpack_list(self):
        """Giải nén chuỗi JSON trong cột grammar thành list tuples"""
        if self.grammar:
            try:
                return json.loads(self.grammar)
            except json.JSONDecodeError:
                return []
        return []

    def __repr__(self) -> str:
        return f"Lookup: {self.lookup_key}"
