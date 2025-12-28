# Path: src/dict_builder/db/models/bold_definitions.py
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base

class BoldDefinition(Base):
    __tablename__ = "bold_definitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    file_name: Mapped[str] = mapped_column(default="")
    ref_code: Mapped[str] = mapped_column(default="")
    nikaya: Mapped[str] = mapped_column(default="")
    book: Mapped[str] = mapped_column(default="")
    title: Mapped[str] = mapped_column(default="")
    subhead: Mapped[str] = mapped_column(default="")
    bold: Mapped[str] = mapped_column(default="")
    bold_end: Mapped[str] = mapped_column(default="")
    commentary: Mapped[str] = mapped_column(default="")

    def update_bold_definition(
        self,
        file_name,
        ref_code,
        nikaya,
        book,
        title,
        subhead,
        bold,
        bold_end,
        commentary,
    ):
        self.file_name = file_name
        self.ref_code = ref_code
        self.nikaya = nikaya
        self.book = book
        self.title = title
        self.subhead = subhead
        self.bold = bold
        self.bold_end = bold_end
        self.commentary = commentary

    def __repr__(self) -> str:
        return f"""
{"file_name":<20}{self.file_name}
{"ref_code":<20}{self.ref_code}
{"nikaya":<20}{self.nikaya}
{"book":<20}{self.book}
{"title":<20}{self.title}
{"subhead":<20}{self.subhead}
{"bold":<20}{self.bold}
{"bold_end":<20}{self.bold_end}
{"commentary":<20}{self.commentary}
"""
