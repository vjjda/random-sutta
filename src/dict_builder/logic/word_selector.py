# Path: src/dict_builder/logic/word_selector.py
from typing import List
from rich import print
from sqlalchemy.orm import Session

from src.db.models import DpdHeadword
from src.tools.text_scanner import get_ebts_word_set
from src.tools.deconstructed_words import make_words_in_deconstructions
from ..config import BuilderConfig

class WordSelector:
    def __init__(self, config: BuilderConfig):
        self.config = config

    def get_target_ids(self, session: Session) -> List[int]:
        """Lấy danh sách ID cần xử lý dựa trên Config Mode."""
        print(f"[green]Scanning DPD DB (Mode: {self.config.mode})...")
        
        # Query tối giản để tiết kiệm RAM
        query = session.query(DpdHeadword.id, DpdHeadword.lemma_1, DpdHeadword.inflections, DpdHeadword.inflections_api_ca_eva_iti)
        
        if self.config.is_full_mode:
            print("[green]Full Mode: Selecting all IDs.")
            return [row.id for row in query.all()]

        # --- MINI MODE LOGIC ---
        print("[yellow]Calculating EBTS word set...")
        bilara_path = self.config.PROJECT_ROOT / "data/bilara/root/pli/ms"
        
        if not bilara_path.exists():
            print(f"[red]Bilara data missing at {bilara_path}")
            return []

        target_set = get_ebts_word_set(bilara_path, self.config.EBTS_BOOKS)
        decon_set = make_words_in_deconstructions(session)
        target_set = target_set | decon_set
        
        print(f"[green]Target words pool: {len(target_set)}")
        
        target_ids = []
        rows = query.all()
        total_rows = len(rows)
        
        for idx, row in enumerate(rows):
            # Clean lemma cơ bản để check nhanh
            lemma_clean = row.lemma_1.split(" ")[0]
            
            # 1. Check Lemma
            if lemma_clean in target_set:
                target_ids.append(row.id)
                continue
            
            # 2. Check Inflections (Tốn kém hơn nên check sau)
            infs = []
            if row.inflections: infs.extend(row.inflections.split(","))
            if row.inflections_api_ca_eva_iti: infs.extend(row.inflections_api_ca_eva_iti.split(","))
            
            if not set(infs).isdisjoint(target_set):
                target_ids.append(row.id)
                
        print(f"[green]Filtered down to {len(target_ids)} / {total_rows} entries.")
        return target_ids