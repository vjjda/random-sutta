# Path: src/db/models.py
import re
import json
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import declarative_base, relationship, Mapped, mapped_column

from src.tools.meaning_construction import make_meaning_combo_html, make_grammar_line

Base = declarative_base()

class DpdRoot(Base):
    __tablename__ = "dpd_roots"
    root: Mapped[str] = mapped_column(primary_key=True)
    root_group: Mapped[int] = mapped_column(default=0)
    root_sign: Mapped[str] = mapped_column(default="")
    root_meaning: Mapped[str] = mapped_column(default="")
    root_has_verb: Mapped[str] = mapped_column(default="")
    
    # [FIXED] Thêm các cột thiếu cho Root Info
    root_in_comps: Mapped[str] = mapped_column(default="")
    sanskrit_root: Mapped[str] = mapped_column(default="")
    sanskrit_root_meaning: Mapped[str] = mapped_column(default="")
    sanskrit_root_class: Mapped[str] = mapped_column(default="")
    
    @property
    def root_clean(self) -> str:
        return re.sub(r" \d.*$", "", self.root)

class DpdHeadword(Base):
    __tablename__ = "dpd_headwords"

    id: Mapped[int] = mapped_column(primary_key=True)
    lemma_1: Mapped[str] = mapped_column(default="")
    
    pos: Mapped[str] = mapped_column(default="")
    grammar: Mapped[str] = mapped_column(default="")
    neg: Mapped[str] = mapped_column(default="")
    verb: Mapped[str] = mapped_column(default="")
    trans: Mapped[str] = mapped_column(default="")
    plus_case: Mapped[str] = mapped_column(default="")
    
    meaning_1: Mapped[str] = mapped_column(default="")
    meaning_lit: Mapped[str] = mapped_column(default="")
    meaning_2: Mapped[str] = mapped_column(default="")
    
    # [FIXED] Thêm cột non_ia
    non_ia: Mapped[str] = mapped_column(default="")
    sanskrit: Mapped[str] = mapped_column(default="")
    
    root_key: Mapped[str] = mapped_column(ForeignKey("dpd_roots.root"), default="")
    root_sign: Mapped[str] = mapped_column(default="")
    root_base: Mapped[str] = mapped_column(default="")
    family_root: Mapped[str] = mapped_column(default="")
    family_word: Mapped[str] = mapped_column(default="")
    family_compound: Mapped[str] = mapped_column(default="")
    family_idioms: Mapped[str] = mapped_column(default="")
    family_set: Mapped[str] = mapped_column(default="")
    
    construction: Mapped[str] = mapped_column(default="")
    derivative: Mapped[str] = mapped_column(default="")
    suffix: Mapped[str] = mapped_column(default="")
    phonetic: Mapped[str] = mapped_column(default="")
    compound_type: Mapped[str] = mapped_column(default="")
    compound_construction: Mapped[str] = mapped_column(default="")
    
    antonym: Mapped[str] = mapped_column(default="")
    synonym: Mapped[str] = mapped_column(default="")
    variant: Mapped[str] = mapped_column(default="")
    
    commentary: Mapped[str] = mapped_column(default="")
    notes: Mapped[str] = mapped_column(default="")
    cognate: Mapped[str] = mapped_column(default="")
    link: Mapped[str] = mapped_column(default="")
    origin: Mapped[str] = mapped_column(default="")
    
    example_1: Mapped[str] = mapped_column(default="")
    source_1: Mapped[str] = mapped_column(default="")
    sutta_1: Mapped[str] = mapped_column(default="")
    example_2: Mapped[str] = mapped_column(default="")
    source_2: Mapped[str] = mapped_column(default="")
    sutta_2: Mapped[str] = mapped_column(default="")
    
    inflections: Mapped[str] = mapped_column(default="")
    inflections_api_ca_eva_iti: Mapped[str] = mapped_column(default="")
    
    ebt_count: Mapped[int] = mapped_column(default=0)

    # Relationships
    rt: Mapped[DpdRoot] = relationship("DpdRoot", uselist=False)

    @property
    def lemma_clean(self) -> str:
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
        infs = []
        if self.inflections:
            infs.extend(self.inflections.split(","))
        if self.inflections_api_ca_eva_iti:
            infs.extend(self.inflections_api_ca_eva_iti.split(","))
        return infs

    # Helper properties
    @property
    def meaning_combo_html(self):
        return make_meaning_combo_html(self)
    
    @property
    def construction_summary(self):
        return self.construction.split("\n")[0] if self.construction else ""
        
    @property
    def degree_of_completion_html(self):
        if self.meaning_1 and self.example_1:
            return " <span style='color:gray'>✔</span>" 
        return ""

class Lookup(Base):
    __tablename__ = "lookup"
    
    lookup_key: Mapped[str] = mapped_column(primary_key=True)
    deconstructor: Mapped[str] = mapped_column(default="")
    
    @property
    def deconstructor_unpack_list(self):
        if self.deconstructor:
            try:
                return json.loads(self.deconstructor)
            except json.JSONDecodeError:
                return []
        return []