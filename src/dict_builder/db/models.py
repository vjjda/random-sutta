# Path: src/dict_builder/db/models.py
import re
import json
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import declarative_base, relationship, Mapped, mapped_column

from src.dict_builder.tools.meaning_construction import make_meaning_combo_html, make_grammar_line

Base = declarative_base()

class DpdRoot(Base):
    __tablename__ = "dpd_roots"
    
    root: Mapped[str] = mapped_column(primary_key=True)
    root_group: Mapped[int] = mapped_column(default=0)
    root_sign: Mapped[str] = mapped_column(default="")
    root_meaning: Mapped[str] = mapped_column(default="")
    root_has_verb: Mapped[str] = mapped_column(default="")
    
    # Các cột bổ sung để khớp với template grammar
    root_in_comps: Mapped[str] = mapped_column(default="")
    sanskrit_root: Mapped[str] = mapped_column(default="")
    sanskrit_root_meaning: Mapped[str] = mapped_column(default="")
    sanskrit_root_class: Mapped[str] = mapped_column(default="")
    
    @property
    def root_clean(self) -> str:
        """Loại bỏ số thứ tự ở cuối căn tố (VD: '√gam 1' -> '√gam')"""
        return re.sub(r" \d.*$", "", self.root)

class DpdHeadword(Base):
    __tablename__ = "dpd_headwords"

    id: Mapped[int] = mapped_column(primary_key=True)
    lemma_1: Mapped[str] = mapped_column(default="")
    
    # Grammar Info
    pos: Mapped[str] = mapped_column(default="")
    grammar: Mapped[str] = mapped_column(default="")
    neg: Mapped[str] = mapped_column(default="")
    verb: Mapped[str] = mapped_column(default="")
    trans: Mapped[str] = mapped_column(default="")
    plus_case: Mapped[str] = mapped_column(default="")
    
    # Meaning
    meaning_1: Mapped[str] = mapped_column(default="")
    meaning_lit: Mapped[str] = mapped_column(default="")
    meaning_2: Mapped[str] = mapped_column(default="")
    
    # Variants & Sanskrit
    non_ia: Mapped[str] = mapped_column(default="")
    sanskrit: Mapped[str] = mapped_column(default="")
    
    # Root Family Relations
    root_key: Mapped[str] = mapped_column(ForeignKey("dpd_roots.root"), default="")
    root_sign: Mapped[str] = mapped_column(default="")
    root_base: Mapped[str] = mapped_column(default="")
    
    family_root: Mapped[str] = mapped_column(default="")
    family_word: Mapped[str] = mapped_column(default="")
    family_compound: Mapped[str] = mapped_column(default="")
    family_idioms: Mapped[str] = mapped_column(default="")
    family_set: Mapped[str] = mapped_column(default="")
    
    # Construction & Phonetics
    construction: Mapped[str] = mapped_column(default="")
    derivative: Mapped[str] = mapped_column(default="")
    suffix: Mapped[str] = mapped_column(default="")
    phonetic: Mapped[str] = mapped_column(default="")
    compound_type: Mapped[str] = mapped_column(default="")
    compound_construction: Mapped[str] = mapped_column(default="")
    
    # Related Words
    antonym: Mapped[str] = mapped_column(default="")
    synonym: Mapped[str] = mapped_column(default="")
    variant: Mapped[str] = mapped_column(default="")
    
    # Metadata & Links
    commentary: Mapped[str] = mapped_column(default="")
    notes: Mapped[str] = mapped_column(default="")
    cognate: Mapped[str] = mapped_column(default="")
    link: Mapped[str] = mapped_column(default="")
    origin: Mapped[str] = mapped_column(default="")
    
    # Examples
    example_1: Mapped[str] = mapped_column(default="")
    source_1: Mapped[str] = mapped_column(default="")
    sutta_1: Mapped[str] = mapped_column(default="")
    example_2: Mapped[str] = mapped_column(default="")
    source_2: Mapped[str] = mapped_column(default="")
    sutta_2: Mapped[str] = mapped_column(default="")
    
    # Inflections & Stats
    inflections: Mapped[str] = mapped_column(default="")
    inflections_api_ca_eva_iti: Mapped[str] = mapped_column(default="")
    
    ebt_count: Mapped[int] = mapped_column(default=0)

    # Relationships
    rt: Mapped[DpdRoot] = relationship("DpdRoot", uselist=False)

    # --- Properties ---

    @property
    def lemma_clean(self) -> str:
        """Loại bỏ số thứ tự ở cuối từ (VD: 'buddha 1' -> 'buddha')"""
        if self.lemma_1:
            return re.sub(r" \d.*$", "", self.lemma_1)
        return ""
        
    @property
    def root_clean(self) -> str:
        if self.root_key:
             return re.sub(r" \d.*$", "", self.root_key)
        return ""

    @property
    def inflections_list_all(self):
        """Trả về list các biến thể từ"""
        infs = []
        if self.inflections:
            infs.extend(self.inflections.split(","))
        if self.inflections_api_ca_eva_iti:
            infs.extend(self.inflections_api_ca_eva_iti.split(","))
        return infs

    # Helper properties for Rendering
    @property
    def meaning_combo_html(self):
        return make_meaning_combo_html(self)
    
    @property
    def construction_summary(self):
        """Lấy dòng đầu tiên của construction để hiển thị tóm tắt"""
        return self.construction.split("\n")[0] if self.construction else ""
        
    @property
    def degree_of_completion_html(self):
        """Trả về HTML cho hiển thị trên web/kindle (chỉ hiện dấu ✔ màu xám)."""
        if self.meaning_1 and self.example_1:
            return " <span style='color:gray'>✔</span>" 
        return ""

    @property
    def degree_of_completion(self) -> str:
        """
        Trả về ký tự biểu thị mức độ hoàn thiện dữ liệu (Text only) cho Tiny Mode.
        ✔: Đầy đủ (nghĩa + ví dụ)
        ◑: Bán phần (có nghĩa, thiếu ví dụ)
        ✘: Chưa hoàn thiện
        """
        if self.meaning_1 and self.example_1:
            return "✔"
        elif self.meaning_1:
            return "◑"
        return "✘"

class Lookup(Base):
    __tablename__ = "lookup"
    
    # Trong DB gốc, lookup_key đóng vai trò là Primary Key
    lookup_key: Mapped[str] = mapped_column(primary_key=True)
    
    # Cột này chứa JSON string trong DB gốc
    deconstructor: Mapped[str] = mapped_column(default="")
    grammar: Mapped[str] = mapped_column(default="")

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