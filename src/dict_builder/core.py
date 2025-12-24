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
from .logic.batch_worker import process_batch_worker, process_decon_worker

class DictBuilder:
    # [UPDATED] Thêm html_mode
    def __init__(self, mode: str = "mini", html_mode: bool = False):
        self.config = BuilderConfig(mode=mode, html_mode=html_mode)
        
    def run(self):
        start_time = time.time()
        # Hiển thị mode rõ ràng hơn
        fmt = "HTML" if self.config.html_mode else "JSON"
        print(f"🚀 Starting Dictionary Builder (Mode: {self.config.mode}, Format: {fmt})...")
        
        # ... (Phần logic run() giữ nguyên hoàn toàn) ...
        output_db = OutputDatabase(self.config)
        output_db.setup()

        session = get_db_session(self.config.DPD_DB_PATH)
        selector = WordSelector(self.config)
        target_ids, target_set = selector.get_target_ids(session)
        
        if not target_ids:
            print("[red]No targets found. Aborting.")
            session.close()
            return

        # PHASE 1
        BATCH_SIZE = 2500
        chunks = [target_ids[i:i + BATCH_SIZE] for i in range(0, len(target_ids), BATCH_SIZE)]
        print(f"[green]Processing {len(target_ids)} headwords in {len(chunks)} chunks...")
        processed_count = 0
        with ProcessPoolExecutor() as executor:
            futures = [executor.submit(process_batch_worker, chunk, self.config, target_set) for chunk in chunks]
            for future in as_completed(futures):
                try:
                    entries, lookups = future.result()
                    output_db.insert_batch(entries, lookups)
                    processed_count += len(entries)
                    print(f"   Saved headwords... ({processed_count}/{len(target_ids)})", end="\r")
                except Exception as e:
                    print(f"[red]Batch processing error: {e}")
        print(f"\n[green]Headwords processing finished in {time.time() - start_time:.2f}s")

        # PHASE 2
        print("[green]Processing Deconstructions (Parallel)...")
        decon_keys = [r.lookup_key for r in session.query(Lookup.lookup_key).filter(Lookup.deconstructor != "").all()]
        DECON_BATCH_SIZE = 5000
        decon_chunks = []
        for i in range(0, len(decon_keys), DECON_BATCH_SIZE):
            chunk_keys = decon_keys[i : i + DECON_BATCH_SIZE]
            start_id = i + 1 
            decon_chunks.append((chunk_keys, start_id))
        print(f"[green]Processing {len(decon_keys)} deconstructions in {len(decon_chunks)} chunks...")
        processed_decon = 0
        with ProcessPoolExecutor() as executor:
            futures = [executor.submit(process_decon_worker, chunk, start_id, self.config) for chunk, start_id in decon_chunks]
            for future in as_completed(futures):
                try:
                    decons, lookups = future.result()
                    output_db.insert_deconstructions(decons, lookups)
                    processed_decon += len(decons)
                    print(f"   Saved deconstructions... ({processed_decon}/{len(decon_keys)})", end="\r")
                except Exception as e:
                    print(f"[red]Decon batch error: {e}")

        # PHASE 3
        output_db.close()
        session.close()
        
        print(f"\n✅ Build Complete: {self.config.output_path}")
        print(f"⏱️ Total Time: {time.time() - start_time:.2f}s")

# [UPDATED] Hàm wrapper nhận thêm html_mode
def run_builder(mode: str = "mini", html_mode: bool = False):
    builder = DictBuilder(mode=mode, html_mode=html_mode)
    builder.run()