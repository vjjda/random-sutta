# Path: src/sutta_processor/optimizer/orchestrator.py
import json
import logging
import os
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from ..shared.app_config import STAGE_PROCESSED_DIR
from .io_manager import IOManager
from .pool_manager import PoolManager
from .worker import process_book_task

logger = logging.getLogger("Optimizer.Main")

class DBOrchestrator:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.io = IOManager(dry_run)
        self.pool_manager = PoolManager()
        self.global_locator = {}

    def run(self):
        mode_str = "DRY-RUN" if self.dry_run else "PRODUCTION"
        logger.info(f"🚀 Starting Parallel Optimization (v2 - Slim Struct): {mode_str}")
        self.io.setup_directories()

        all_files = sorted(list(STAGE_PROCESSED_DIR.rglob("*.json")))
        book_files = []
        
        # 1. Xử lý Super Book (Main Thread)
        for f in all_files:
            if f.name == "super_book.json":
                self._process_super(f)
            else:
                book_files.append(f)

        # 2. Xử lý Sách (Multi-Process)
        max_workers = min(os.cpu_count() or 4, 8)
        
        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(process_book_task, f, self.dry_run): f.name 
                for f in book_files
            }

            for future in as_completed(futures):
                fname = futures[future]
                try:
                    res = future.result()
                    if res["status"] == "success":
                        # Merge Locator từ sách con (sẽ ghi đè Super Book nếu trùng key)
                        self.global_locator.update(res["locators"])
                        self.pool_manager.merge_worker_result(
                            res["book_id"], 
                            res["valid_uids"]
                        )
                        logger.info(f"   ✅ Processed: {fname}")
                    else:
                        logger.warning(f"   ⚠️ Worker failure: {fname}")
                except Exception as e:
                    logger.error(f"   ❌ Exception: {e}")

        self._save_master_index()
        
        if not self.dry_run:
            self.pool_manager.generate_js_constants()

        logger.info("✨ Optimization Completed.")

    def _process_super(self, file_path: Path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Save Super Struct
            self.io.save_dual("structure/super_struct.json", data)
            self.pool_manager.register_sutta_books(data)
            
            # [FIXED] Populate Global Locator cho Super Items
            # Gán cứng locator trỏ về file super_struct
            meta = data.get("meta", {})
            for uid in meta.keys():
                # Format đặc biệt để FE nhận biết: "structure/<tên_file_không_đuôi>"
                self.global_locator[uid] = "structure/super_struct"
                
            logger.info(f"   🌟 Super Book Processed ({len(meta)} keys indexed)")
        except Exception as e:
            logger.error(f"❌ Error super_book: {e}")

    def _save_master_index(self):
        index_data = {
            "pools": self.pool_manager.pools,
            "locator": self.global_locator
        }
        self.io.save_dual("uid_index.json", index_data)

def run_optimizer(dry_run: bool = False):
    orchestrator = DBOrchestrator(dry_run)
    orchestrator.run()