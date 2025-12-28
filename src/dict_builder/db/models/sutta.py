# Path: src/dict_builder/db/models/sutta.py
import re
from sqlalchemy import or_
from sqlalchemy.orm import Mapped, mapped_column, object_session
from .base import Base

class SuttaInfo(Base):
    __tablename__ = "sutta_info"
    # dpd
    book: Mapped[str] = mapped_column(default="")
    book_code: Mapped[str] = mapped_column(default="")
    dpd_code: Mapped[str] = mapped_column(default="")
    dpd_sutta: Mapped[str] = mapped_column(primary_key=True)
    dpd_sutta_var: Mapped[str] = mapped_column(default="")
    # cst
    cst_code: Mapped[str] = mapped_column(default="")
    cst_nikaya: Mapped[str] = mapped_column(default="")
    cst_book: Mapped[str] = mapped_column(default="")
    cst_section: Mapped[str] = mapped_column(default="")
    cst_vagga: Mapped[str] = mapped_column(default="")
    cst_sutta: Mapped[str] = mapped_column(default="")
    cst_paranum: Mapped[str] = mapped_column(default="")
    cst_m_page: Mapped[str] = mapped_column(default="")
    cst_v_page: Mapped[str] = mapped_column(default="")
    cst_p_page: Mapped[str] = mapped_column(default="")
    cst_t_page: Mapped[str] = mapped_column(default="")
    cst_file: Mapped[str] = mapped_column(default="")
    # sutta central
    sc_code: Mapped[str] = mapped_column(default="")
    sc_book: Mapped[str] = mapped_column(default="")
    sc_vagga: Mapped[str] = mapped_column(default="")
    sc_sutta: Mapped[str] = mapped_column(default="")
    sc_eng_sutta: Mapped[str] = mapped_column(default="")
    sc_blurb: Mapped[str] = mapped_column(default="")
    # sc_card_link: Mapped[str] = mapped_column(default="")
    # sc_pali_link: Mapped[str] = mapped_column(default="")
    # sc_eng_link: Mapped[str] = mapped_column(default="")
    sc_file_path: Mapped[str] = mapped_column(default="")
    dpr_code: Mapped[str] = mapped_column(default="")
    dpr_link: Mapped[str] = mapped_column(default="")
    # bjt
    bjt_sutta_code: Mapped[str] = mapped_column(default="")
    bjt_web_code: Mapped[str] = mapped_column(default="")
    bjt_filename: Mapped[str] = mapped_column(default="")
    bjt_book_id: Mapped[str] = mapped_column(default="")
    bjt_page_num: Mapped[str] = mapped_column(default="")
    bjt_page_offset: Mapped[str] = mapped_column(default="")
    bjt_piṭaka: Mapped[str] = mapped_column(default="")
    bjt_nikāya: Mapped[str] = mapped_column(default="")
    bjt_major_section: Mapped[str] = mapped_column(default="")
    bjt_book: Mapped[str] = mapped_column(default="")
    bjt_minor_section: Mapped[str] = mapped_column(default="")
    bjt_vagga: Mapped[str] = mapped_column(default="")
    bjt_sutta: Mapped[str] = mapped_column(default="")

    dv_pts: Mapped[str] = mapped_column(default="")
    dv_main_theme: Mapped[str] = mapped_column(default="")
    dv_subtopic: Mapped[str] = mapped_column(default="")
    dv_summary: Mapped[str] = mapped_column(default="")
    dv_similes: Mapped[str] = mapped_column(default="")
    dv_key_excerpt1: Mapped[str] = mapped_column(default="")
    dv_key_excerpt2: Mapped[str] = mapped_column(default="")
    dv_stage: Mapped[str] = mapped_column(default="")
    dv_training: Mapped[str] = mapped_column(default="")
    dv_aspect: Mapped[str] = mapped_column(default="")
    dv_teacher: Mapped[str] = mapped_column(default="")
    dv_audience: Mapped[str] = mapped_column(default="")
    dv_method: Mapped[str] = mapped_column(default="")
    dv_length: Mapped[str] = mapped_column(default="")
    dv_prominence: Mapped[str] = mapped_column(default="")
    dv_nikayas_parallels: Mapped[str] = mapped_column(default="")
    dv_āgamas_parallels: Mapped[str] = mapped_column(default="")
    dv_taisho_parallels: Mapped[str] = mapped_column(default="")
    dv_sanskrit_parallels: Mapped[str] = mapped_column(default="")
    dv_vinaya_parallels: Mapped[str] = mapped_column(default="")
    dv_others_parallels: Mapped[str] = mapped_column(default="")
    dv_partial_parallels_nā: Mapped[str] = mapped_column(default="")
    dv_partial_parallels_all: Mapped[str] = mapped_column(default="")
    dv_suggested_suttas: Mapped[str] = mapped_column(default="")

    @property
    def sc_card_link(self) -> str | None:
        if self.sc_code:
            return f"https://suttacentral.net/{self.sc_code}"
        else:
            return None

    @property
    def sc_pali_link(self) -> str | None:
        if self.sc_code:
            return f"https://suttacentral.net/{self.sc_code}/pli/ms"
        else:
            return None

    @property
    def sc_eng_link(self) -> str | None:
        if self.sc_code:
            return f"https://suttacentral.net/{self.sc_code}/en/sujato"
        else:
            return None

    @property
    def sc_book_code(self) -> str | None:
        if self.sc_code:
            return re.sub(r"\d+\.*-*\d*", "", self.sc_code)
        else:
            return None

    @property
    def sc_github(self) -> str | None:
        if self.sc_code:
            return (
                f"https://github.com/suttacentral/sc-data/blob/main/{self.sc_file_path}"
            )
        else:
            return None

    @property
    def sc_express_link(self) -> str | None:
        if self.sc_code:
            return f"https://suttacentral.express/{self.sc_code.lower()}/en/sujato"
        else:
            return None

    @property
    def dhamma_gift(self) -> str | None:
        if self.sc_code:
            return f"https://find.dhamma.gift/read/?q={self.sc_code}"
        else:
            return None
    
    # ... (Các property khác như tbw, tbw_legacy có thể thêm sau nếu cần thiết)

    @property
    def sutta_info_count(self) -> int:
        db_session = object_session(self)
        if db_session is None:
            return 0
        
        from .headword import DpdHeadword
        return (
            db_session.query(SuttaInfo)
            .filter(
                or_(
                    DpdHeadword.lemma_1 == self.dpd_sutta,
                    DpdHeadword.lemma_1 == self.dpd_sutta_var,
                )
            )
            .count()
        )

    # ... (Các logic khác của Source)

    def __repr__(self) -> str:
        return f"SuttaInfo: {self.dpd_code} {self.dpd_sutta}"
