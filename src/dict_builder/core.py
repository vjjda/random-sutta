# Path: src/dict_builder/core.py
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from rich import print

from src.db.db_helpers import get_db_session
from src.db.models import Lookup

from .config import BuilderConfig
from .renderer import DpdRenderer

from .logic.output_database import OutputDatabase
from .logic.word_selector import WordSelector
from .logic.batch_worker import process_batch_worker, process_decon_worker # [IMPORT NEW WORKER]

class DictBuilder:
    def __init__(self, mode: str = "mini"):
        self.config = BuilderConfig(mode=mode)
        
    def run(self):
        start_time = time.time()
        print(f"🚀 Starting Dictionary Builder (Strict Lookups)...")
        
        output_db = OutputDatabase(self.config)
        output_db.setup()

        session = get_db_session(self.config.DPD_DB_PATH)
        selector = WordSelector(self.config)
        
        # [CHANGED] Nhận về cả target_set
        target_ids, target_set = selector.get_target_ids(session)
        
        if not target_ids:
            session.close()
            return

        # --- PHASE 1: HEADWORDS ---
        BATCH_SIZE = 2000
        chunks = [target_ids[i:i + BATCH_SIZE] for i in range(0, len(target_ids), BATCH_SIZE)]
        print(f"[green]Processing {len(target_ids)} headwords in {len(chunks)} chunks...")

        processed_count = 0
        with ProcessPoolExecutor() as executor:
            # [CHANGED] Truyền target_set vào worker
            futures = [executor.submit(process_batch_worker, chunk, self.config, target_set) for chunk in chunks]
            
            for future in as_completed(futures):
                entries, lookups = future.result()
                output_db.insert_batch(entries, lookups)
                processed_count += len(entries)
                print(f"   Saved headwords... ({processed_count}/{len(target_ids)})", end="\r")
        
        print(f"\n[green]Headwords done in {time.time() - start_time:.2f}s")

        # --- PHASE 2: DECONSTRUCTIONS ---
        # ... (Phần này giữ nguyên logic cũ) ...
        # (Lưu ý: Deconstruction không cần lọc kỹ target_set vì bản thân nó đã được lọc từ đầu rồi)
        
        print("[green]Processing Deconstructions (Parallel)...")
        decon_keys = [r.lookup_key for r in session.query(Lookup.lookup_key).filter(Lookup.deconstructor != "").all()]
        
        # Có thể áp dụng lọc cho Deconstructions nếu muốn siêu tối ưu:
        if target_set is not None:
             decon_keys = [k for k in decon_keys if k in target_set]

        DECON_BATCH_SIZE = 5000
        decon_chunks = []
        for i in range(0, len(decon_keys), DECON_BATCH_SIZE):
            chunk_keys = decon_keys[i : i + DECON_BATCH_SIZE]
            start_id = i + 1
            decon_chunks.append((chunk_keys, start_id))
            
        # ... (Phần chạy executor cho decon giữ nguyên) ...
        processed_decon = 0
        with ProcessPoolExecutor() as executor:
            futures = [executor.submit(process_decon_worker, chunk, start_id, self.config) for chunk, start_id in decon_chunks]
            
            for future in as_completed(futures):
                decons, lookups = future.result()
                output_db.insert_deconstructions(decons, lookups)
                processed_decon += len(decons)
                print(f"   Saved deconstructions... ({processed_decon}/{len(decon_keys)})", end="\r")

        # --- PHASE 3: CLEANUP ---
        output_db.close()
        session.close()
        
        print(f"\n✅ Build Complete: {self.config.output_path}")
        print(f"⏱️ Total Time: {time.time() - start_time:.2f}s")