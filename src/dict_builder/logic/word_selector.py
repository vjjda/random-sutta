# Path: src/dict_builder/logic/word_selector.py
from typing import List, Tuple, Set, Optional
from rich import print
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.dict_builder.db.models import DpdHeadword
from src.dict_builder.tools.deconstructed_words import make_words_in_deconstructions
from src.dict_builder.logic.ebts_loader import load_cached_ebts_words
from ..config import BuilderConfig

class WordSelector:
    def __init__(self, config: BuilderConfig):
        self.config = config

    # [CHANGED] Return type: Tuple[List[int], Optional[Set[str]]]
    def get_target_ids(self, session: Session) -> Tuple[List[int], Optional[Set[str]]]:
        """
        Lấy danh sách ID cần xử lý và tập từ vựng đích (nếu có).
        """
        print(f"[green]Scanning DPD DB (Mode: {self.config.mode})...")
        
        stmt = select(
            DpdHeadword.id, 
            DpdHeadword.lemma_1, 
            DpdHeadword.inflections, 
            DpdHeadword.inflections_api_ca_eva_iti
        )
        
        # FULL MODE: Không lọc gì cả -> target_set = None
        if self.config.is_full_mode:
            print("[green]Full Mode: Selecting all IDs.")
            all_ids = session.execute(select(DpdHeadword.id)).scalars().all()
            return all_ids, None

        # MINI / TINY MODE
        bilara_path = self.config.PROJECT_ROOT / "data/bilara/root/pli/ms"
        
        if not bilara_path.exists():
            print(f"[red]Bilara data missing at {bilara_path}")
            return [], set()

        # Cache dir in .gemini/tmp or just data/.cache
        cache_dir = self.config.PROJECT_ROOT / "data/.cache/dict_builder"
        
        target_set = load_cached_ebts_words(bilara_path, self.config.EBTS_BOOKS, cache_dir)
        
        print("[yellow]Calculating Deconstruction word set...")
        decon_set = make_words_in_deconstructions(session)
        target_set = target_set | decon_set
        
        print(f"[green]Target words pool: {len(target_set)}")
        
        rows = session.execute(stmt).all()
        target_ids = []
        
        for r_id, lemma_1, inf1, inf2 in rows:
            lemma_clean = lemma_1.split(" ", 1)[0]
            
            # Check Lemma
            if lemma_clean in target_set:
                target_ids.append(r_id)
                continue
            
            # Check Inflections (Lazy)
            if inf1 and any(word in target_set for word in inf1.split(",")):
                target_ids.append(r_id)
                continue
            
            if inf2 and any(word in target_set for word in inf2.split(",")):
                target_ids.append(r_id)
                continue
                
        print(f"[green]Filtered down to {len(target_ids)} / {len(rows)} entries.")
        
        # Trả về cả target_set để worker dùng lọc lookups
        return target_ids, target_set