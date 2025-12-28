# Path: src/dict_builder/db/models/root.py
import re
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, object_session
from .base import Base
from src.dict_builder.tools.pali_sort_key import pali_sort_key

if TYPE_CHECKING:
    from .headword import DpdHeadword

class DpdRoot(Base):
    __tablename__ = "dpd_roots"

    root: Mapped[str] = mapped_column(primary_key=True)
    root_in_comps: Mapped[str] = mapped_column(default="")
    root_has_verb: Mapped[str] = mapped_column(default="")
    root_group: Mapped[int] = mapped_column(default=0)
    root_sign: Mapped[str] = mapped_column(default="")
    root_meaning: Mapped[str] = mapped_column(default="")
    sanskrit_root: Mapped[str] = mapped_column(default="")
    sanskrit_root_meaning: Mapped[str] = mapped_column(default="")
    sanskrit_root_class: Mapped[str] = mapped_column(default="")
    root_example: Mapped[str] = mapped_column(default="")
    dhatupatha_num: Mapped[str] = mapped_column(default="")
    dhatupatha_root: Mapped[str] = mapped_column(default="")
    dhatupatha_pali: Mapped[str] = mapped_column(default="")
    dhatupatha_english: Mapped[str] = mapped_column(default="")
    dhatumanjusa_num: Mapped[int] = mapped_column(default=0)
    dhatumanjusa_root: Mapped[str] = mapped_column(default="")
    dhatumanjusa_pali: Mapped[str] = mapped_column(default="")
    dhatumanjusa_english: Mapped[str] = mapped_column(default="")
    dhatumala_root: Mapped[str] = mapped_column(default="")
    dhatumala_pali: Mapped[str] = mapped_column(default="")
    dhatumala_english: Mapped[str] = mapped_column(default="")
    panini_root: Mapped[str] = mapped_column(default="")
    panini_sanskrit: Mapped[str] = mapped_column(default="")
    panini_english: Mapped[str] = mapped_column(default="")
    note: Mapped[str] = mapped_column(default="")
    matrix_test: Mapped[str] = mapped_column(default="")
    root_info: Mapped[str] = mapped_column(default="")
    root_matrix: Mapped[str] = mapped_column(default="")

    created_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    # Relationships (Sẽ import DpdHeadword từ headword.py để tránh circular import nếu cần, 
    # nhưng SQLAlchemy cho phép dùng string forward reference "DpdHeadword")
    pw: Mapped[List["DpdHeadword"]] = relationship("DpdHeadword", back_populates="rt")

    @property
    def root_clean(self) -> str:
        """Remove digits from the end"""
        return re.sub(r" \d.*$", "", self.root)

    @property
    def root_no_sign(self) -> str:
        """Remove digits from the end and root sign"""
        return re.sub(r"\d| |√", "", self.root)

    @property
    def root_(self) -> str:
        """Replace whitespace with underscores"""
        return self.root.replace(" ", "_")

    @property
    def root_no_sign_(self) -> str:
        """Remove root sign and replace whitespace with underscores.
        Useful for html links."""
        return self.root.replace(" ", "_").replace("√", "")

    @property
    def root_link(self) -> str:
        return self.root.replace(" ", "%20")

    @property
    def root_count(self) -> int:
        # Note: logic này cần DpdHeadword đã được import hoặc available trong session
        # Chúng ta tạm comment phần logic thực thi DB nếu chưa cần thiết ngay
        # Hoặc giữ nguyên nếu dự án chạy trong context đã setup đầy đủ.
        db_session = object_session(self)
        if db_session is None:
            return 0 # Fail safe

        # Lazy import to avoid circular dependency
        from .headword import DpdHeadword
        return (
            db_session.query(DpdHeadword)
            .filter(DpdHeadword.root_key == self.root)
            .count()
        )

    @property
    def root_family_list(self) -> list:
        db_session = object_session(self)
        if db_session is None:
            return []

        from .headword import DpdHeadword
        results = (
            db_session.query(DpdHeadword)
            .filter(DpdHeadword.root_key == self.root)
            .group_by(DpdHeadword.family_root)
            .all()
        )
        family_list = [i.family_root for i in results if i.family_root is not None]
        family_list = sorted(family_list, key=lambda x: pali_sort_key(x))
        return family_list

    def __repr__(self) -> str:
        return f"""DpdRoot: {self.root} {self.root_group} {self.root_sign} ({self.root_meaning})"""
