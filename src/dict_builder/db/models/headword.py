# Path: src/dict_builder/db/models/headword.py
import re
import json
from typing import List, Optional
from sqlalchemy import DateTime, ForeignKey, and_, case, func, null
from sqlalchemy.orm import Mapped, mapped_column, relationship, object_session, foreign
from sqlalchemy.ext.hybrid import hybrid_property

from .base import Base
from .root import DpdRoot
from .family import FamilyRoot, FamilyWord, FamilyCompound, FamilySet, FamilyIdiom
from .sutta import SuttaInfo
from src.dict_builder.tools.meaning_construction import (
    make_meaning_combo_html, 
    make_meaning_combo,
    summarize_construction,
    clean_construction,
    make_grammar_line
)
from src.dict_builder.tools.degree_of_completion import degree_of_completion

class InflectionTemplates(Base):
    """Inflection templates for generating html tables."""

    __tablename__ = "inflection_templates"
    pattern: Mapped[str] = mapped_column(primary_key=True)
    like: Mapped[str] = mapped_column(default="")
    data: Mapped[str] = mapped_column(default="")

    def inflection_template_pack(self, list: list[str]) -> None:
        self.data = json.dumps(list, ensure_ascii=False)

    @property
    def inflection_template_unpack(self) -> list[str]:
        return json.loads(self.data) if self.data else []

    def __repr__(self) -> str:
        return f"InflectionTemplates: {self.pattern} {self.like} {self.data}"


class DpdHeadword(Base):
    __tablename__ = "dpd_headwords"

    id: Mapped[int] = mapped_column(primary_key=True)
    lemma_1: Mapped[str] = mapped_column(ForeignKey("sutta_info.dpd_sutta"), default="")
    lemma_2: Mapped[str] = mapped_column(default="")
    pos: Mapped[str] = mapped_column(default="")
    grammar: Mapped[str] = mapped_column(default="")
    derived_from: Mapped[str] = mapped_column(default="")
    neg: Mapped[str] = mapped_column(default="")
    verb: Mapped[str] = mapped_column(default="")
    trans: Mapped[str] = mapped_column(default="")
    plus_case: Mapped[str] = mapped_column(default="")

    meaning_1: Mapped[str] = mapped_column(default="")
    meaning_lit: Mapped[str] = mapped_column(default="")
    meaning_2: Mapped[str] = mapped_column(default="")

    non_ia: Mapped[str] = mapped_column(default="")
    sanskrit: Mapped[str] = mapped_column(default="")

    root_key: Mapped[str] = mapped_column(ForeignKey("dpd_roots.root"), default="")
    root_sign: Mapped[str] = mapped_column(default="")
    root_base: Mapped[str] = mapped_column(default="")

    family_root: Mapped[str] = mapped_column(default="")
    family_word: Mapped[str] = mapped_column(
        ForeignKey("family_word.word_family"), default=""
    )
    family_compound: Mapped[str] = mapped_column(default="")
    family_idioms: Mapped[str] = mapped_column(default="")
    family_set: Mapped[str] = mapped_column(default="")

    construction: Mapped[str] = mapped_column(default="")
    derivative: Mapped[str] = mapped_column(default="")
    suffix: Mapped[str] = mapped_column(default="")
    phonetic: Mapped[str] = mapped_column(default="")
    compound_type: Mapped[str] = mapped_column(default="")
    compound_construction: Mapped[str] = mapped_column(default="")
    non_root_in_comps: Mapped[str] = mapped_column(default="")

    source_1: Mapped[str] = mapped_column(default="")
    sutta_1: Mapped[str] = mapped_column(default="")
    example_1: Mapped[str] = mapped_column(default="")

    source_2: Mapped[str] = mapped_column(default="")
    sutta_2: Mapped[str] = mapped_column(default="")
    example_2: Mapped[str] = mapped_column(default="")

    antonym: Mapped[str] = mapped_column(default="")
    synonym: Mapped[str] = mapped_column(default="")
    variant: Mapped[str] = mapped_column(default="")
    var_phonetic: Mapped[str] = mapped_column(default="")
    var_text: Mapped[str] = mapped_column(default="")
    commentary: Mapped[str] = mapped_column(default="")
    notes: Mapped[str] = mapped_column(default="")
    cognate: Mapped[str] = mapped_column(default="")
    link: Mapped[str] = mapped_column(default="")
    origin: Mapped[str] = mapped_column(default="")

    stem: Mapped[str] = mapped_column(default="")
    pattern: Mapped[str] = mapped_column(
        ForeignKey("inflection_templates.pattern"), default=""
    )

    created_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    # derived data

    inflections: Mapped[str] = mapped_column(default="")
    inflections_api_ca_eva_iti: Mapped[str] = mapped_column(default="")
    inflections_sinhala: Mapped[str] = mapped_column(default="")
    inflections_devanagari: Mapped[str] = mapped_column(default="")
    inflections_thai: Mapped[str] = mapped_column(default="")
    inflections_html: Mapped[str] = mapped_column(default="")
    freq_data: Mapped[str] = mapped_column(default="")
    freq_html: Mapped[str] = mapped_column(default="")
    ebt_count: Mapped[int] = mapped_column(default=0, server_default="0")

    # Relationships
    rt: Mapped[DpdRoot] = relationship(uselist=False)

    fr = relationship(
        "FamilyRoot",
        primaryjoin=and_(
            root_key == foreign(FamilyRoot.root_key),
            family_root == foreign(FamilyRoot.root_family),
        ),
        uselist=False,
        sync_backref=False,
    )

    #  FamilyWord
    fw = relationship("FamilyWord", uselist=False)

    # inflection templates
    it: Mapped[InflectionTemplates] = relationship()

    # sutta info
    su: Mapped[SuttaInfo] = relationship()

    @hybrid_property
    def root_family_key(self):  # type:ignore
        if self.root_key and self.family_root:
            return f"{self.root_key} {self.family_root}"
        else:
            return ""

    @root_family_key.expression
    def root_family_key(cls):
        return case(
            (
                and_(cls.root_key != null(), cls.family_root != null()),  # type:ignore
                cls.root_key + " " + cls.family_root,
            ),
            else_="",
        )

    @property
    def lemma_1_(self) -> str:
        return self.lemma_1.replace(" ", "_").replace(".", "_")

    @property
    def lemma_link(self) -> str:
        return self.lemma_1.replace(" ", "%20")

    @property
    def lemma_clean(self) -> str:
        return re.sub(r" \d.*$", "", self.lemma_1)
    
    @property
    def root_clean(self) -> str:
        """Helper to get clean root from root_key string without joining DpdRoot."""
        if self.root_key:
             return re.sub(r" \d.*$", "", self.root_key)
        return ""

    @property
    def inflections_list_all(self):
        """Trả về list các biến thể từ (Logic cũ, giữ lại để tương thích batch_worker) """
        infs = []
        if self.inflections:
            infs.extend(self.inflections.split(","))
        if self.inflections_api_ca_eva_iti:
            infs.extend(self.inflections_api_ca_eva_iti.split(","))
        return infs
    
    @property
    def meaning_combo_html(self):
        return make_meaning_combo_html(self)
        
    @property
    def construction_summary(self):
        return summarize_construction(self)
        
    @property
    def degree_of_completion_html(self):
        return degree_of_completion(self, html=True)

    @property
    def degree_of_completion(self) -> str:
        return degree_of_completion(self, html=False)

    def __repr__(self) -> str:
        return f"""DpdHeadword: {self.id} {self.lemma_1} {self.pos} {self.meaning_1}"""
