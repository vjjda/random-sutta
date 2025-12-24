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
from .logic.batch_worker import process_batch_worker

class DictBuilder:
    def __init__(self, mode: str = "mini"):
        self.config = BuilderConfig(mode=mode)
        # Renderer không còn dùng ở đây nữa vì đã bỏ render_deconstruction
        
    def run(self):
        start_time = time.time()
        print(f"🚀 Starting Dictionary Builder (Lite Version)...")
        
        # 1. Setup Output DB
        output_db = OutputDatabase(self.config)
        output_db.setup()

        # 2. Select Targets
        session = get_db_session(self.config.DPD_DB_PATH)
        selector = WordSelector(self.config)
        target_ids = selector.get_target_ids(session)
        
        if not target_ids:
            session.close()
            return

        # 3. Processing Batches (Multiprocessing)
        BATCH_SIZE = 1000
        chunks = [target_ids[i:i + BATCH_SIZE] for i in range(0, len(target_ids), BATCH_SIZE)]
        print(f"[green]Processing {len(target_ids)} items in {len(chunks)} chunks...")

        processed_count = 0
        with ProcessPoolExecutor() as executor:
            futures = [executor.submit(process_batch_worker, chunk, self.config) for chunk in chunks]
            
            for future in as_completed(futures):
                entries, lookups = future.result()
                output_db.insert_batch(entries, lookups)
                
                processed_count += len(entries)
                print(f"   Saved batch... ({processed_count}/{len(target_ids)})", end="\r")
        
        print(f"\n[green]Headwords processing finished in {time.time() - start_time:.2f}s")

        # 4. Process Deconstructions
        print("[green]Processing Deconstructions...")
        deconstructions = session.query(Lookup).filter(Lookup.deconstructor != "").all()
        
        decon_batch = []
        decon_lookup_batch = []
        
        for idx, d in enumerate(deconstructions, start=1):
            # [UPDATED] Không render HTML nữa
            split_str = "; ".join(d.deconstructor_unpack_list)
            
            decon_batch.append((idx, d.lookup_key, split_str))
            decon_lookup_batch.append((d.lookup_key, idx, 'deconstruction', 0))
            
        output_db.insert_deconstructions(decon_batch, decon_lookup_batch)
        
        # 5. Cleanup
        output_db.close()
        session.close()
        
        print(f"✅ Build Complete: {self.config.output_path}")
        print(f"⏱️ Total Time: {time.time() - start_time:.2f}s")

def run_builder():
    builder = DictBuilder(mode="mini")
    builder.run()