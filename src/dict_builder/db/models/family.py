# Path: src/dict_builder/db/models/family.py
import json
from typing import List
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

class FamilyRoot(Base):
    __tablename__ = "family_root"
    root_family_key: Mapped[str] = mapped_column(primary_key=True)
    root_key: Mapped[str] = mapped_column(primary_key=True)
    root_family: Mapped[str] = mapped_column(default="")
    root_meaning: Mapped[str] = mapped_column(default="")
    html: Mapped[str] = mapped_column(default="")
    data: Mapped[str] = mapped_column(default="")
    count: Mapped[int] = mapped_column(default=0)

    def data_pack(self, list: list[str]) -> None:
        self.data = json.dumps(list, ensure_ascii=False, indent=1)

    @property
    def data_unpack(self) -> list[str]:
        return json.loads(self.data) if self.data else []

    @property
    def root_family_link(self) -> str:
        return self.root_family.replace(" ", "%20")

    @property
    def root_family_(self) -> str:
        return self.root_family.replace(" ", "_")

    @property
    def root_family_clean(self) -> str:
        return self.root_family.replace("√", "")

    @property
    def root_family_clean_no_space(self) -> str:
        return self.root_family.replace("√", "").replace(" ", "")

    @property
    def root_family_key_typst(self) -> str:
        return self.root_family_key.replace(" ", "_").replace("√", "")

    def __repr__(self) -> str:
        return f"FamilyRoot: {self.root_family_key} {self.count}"


class FamilyCompound(Base):
    __tablename__ = "family_compound"
    compound_family: Mapped[str] = mapped_column(primary_key=True)
    html: Mapped[str] = mapped_column(default="")
    data: Mapped[str] = mapped_column(default="")
    count: Mapped[int] = mapped_column(default=0)

    def data_pack(self, list: list[str]) -> None:
        self.data = json.dumps(list, ensure_ascii=False, indent=1)

    @property
    def data_unpack(self) -> list[str]:
        return json.loads(self.data) if self.data else []

    def __repr__(self) -> str:
        return f"FamilyCompound: {self.compound_family} {self.count}"


class FamilyWord(Base):
    __tablename__ = "family_word"
    word_family: Mapped[str] = mapped_column(primary_key=True)
    html: Mapped[str] = mapped_column(default="")
    data: Mapped[str] = mapped_column(default="")
    count: Mapped[int] = mapped_column(default=0)

    dpd_headwords: Mapped[List["DpdHeadword"]] = relationship(
        "DpdHeadword", back_populates="fw"
    )

    def data_pack(self, list: list[str]) -> None:
        self.data = json.dumps(list, ensure_ascii=False, indent=1)

    @property
    def data_unpack(self) -> list[str]:
        return json.loads(self.data) if self.data else []

    def __repr__(self) -> str:
        return f"FamilyWord: {self.word_family} {self.count}"


class FamilySet(Base):
    __tablename__ = "family_set"
    set: Mapped[str] = mapped_column(primary_key=True)
    html: Mapped[str] = mapped_column(default="")
    data: Mapped[str] = mapped_column(default="")
    count: Mapped[int] = mapped_column(default=0)

    def data_pack(self, list: list[str]) -> None:
        self.data = json.dumps(list, ensure_ascii=False, indent=1)

    @property
    def data_unpack(self) -> list[str]:
        return json.loads(self.data) if self.data else []

    def __repr__(self) -> str:
        return f"FamilySet: {self.set} {self.count}"


class FamilyIdiom(Base):
    __tablename__ = "family_idiom"
    idiom: Mapped[str] = mapped_column(primary_key=True)
    html: Mapped[str] = mapped_column(default="")
    data: Mapped[str] = mapped_column(default="")
    count: Mapped[int] = mapped_column(default=0)

    def data_pack(self, list: list[str]) -> None:
        self.data = json.dumps(list, ensure_ascii=False, indent=1)

    @property
    def data_unpack(self) -> list[str]:
        return json.loads(self.data) if self.data else []

    def __repr__(self) -> str:
        return f"FamilyIdiom: {self.idiom} {self.count}"
