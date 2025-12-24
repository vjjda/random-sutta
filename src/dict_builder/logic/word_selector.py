# Path: src/dict_builder/logic/word_selector.py
from typing import List
from rich import print
from sqlalchemy import select
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
        
        # [OPTIMIZATION 1] Sử dụng 'select' thuần để lấy Raw Tuples thay vì ORM Objects.
        # Việc này bỏ qua bước khởi tạo Object của SQLAlchemy, tăng tốc độ cực lớn.
        stmt = select(
            DpdHeadword.id, 
            DpdHeadword.lemma_1, 
            DpdHeadword.inflections, 
            DpdHeadword.inflections_api_ca_eva_iti
        )
        
        # Nếu là Full Mode, chỉ cần lấy ID là xong
        if self.config.is_full_mode:
            print("[green]Full Mode: Selecting all IDs.")
            # scalars().all() sẽ trả về list[int] trực tiếp
            return session.execute(select(DpdHeadword.id)).scalars().all()

        # --- MINI / TINY MODE LOGIC ---
        print("[yellow]Calculating EBTS word set...")
        bilara_path = self.config.PROJECT_ROOT / "data/bilara/root/pli/ms"
        
        if not bilara_path.exists():
            print(f"[red]Bilara data missing at {bilara_path}")
            return []

        # Lấy tập từ vựng đích (EBTS + Deconstructions)
        target_set = get_ebts_word_set(bilara_path, self.config.EBTS_BOOKS)
        decon_set = make_words_in_deconstructions(session)
        target_set = target_set | decon_set
        
        print(f"[green]Target words pool: {len(target_set)}")
        
        # Fetch dữ liệu thô (List of Tuples)
        # rows format: [(id, lemma_1, inflections, inflections_api...), ...]
        rows = session.execute(stmt).all()
        total_rows = len(rows)
        
        target_ids = []
        
        # [OPTIMIZATION 2] Xử lý trên Tuple và String nhanh hơn
        for r_id, lemma_1, inf1, inf2 in rows:
            # 1. Check Lemma (Fastest)
            # Dùng split maxsplit=1 để tránh tách toàn bộ chuỗi không cần thiết
            lemma_clean = lemma_1.split(" ", 1)[0]
            
            if lemma_clean in target_set:
                target_ids.append(r_id)
                continue
            
            # 2. Check Inflections (Slower - Lazy Check)
            # Thay vì tạo set() tốn kém, ta dùng generator expression với any().
            # Nó sẽ dừng ngay khi tìm thấy match đầu tiên.
            
            # Kiểm tra inflections thường
            if inf1:
                # Split trả về list, 'any' duyệt qua list này
                if any(word in target_set for word in inf1.split(",")):
                    target_ids.append(r_id)
                    continue
            
            # Kiểm tra inflections api...
            if inf2:
                if any(word in target_set for word in inf2.split(",")):
                    target_ids.append(r_id)
                    continue
                
        print(f"[green]Filtered down to {len(target_ids)} / {total_rows} entries.")
        return target_ids