# Path: src/sutta_processor/optimizer/orchestrator.py
import json
import logging
import os
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List

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
        self.global_locator: Dict[str, str] = {}

    def run(self) -> None:
        mode_str = "DRY-RUN" if self.dry_run else "PRODUCTION"
        logger.info(f"🚀 Starting Parallel Optimization (v4.1 - Clean): {mode_str}")
        self.io.setup_directories()

        all_files = sorted(list(STAGE_PROCESSED_DIR.rglob("*.json")))
        book_files = []
        
        for f in all_files:
            if f.name == "super_book.json":
                self._process_super(f)
            else:
                book_files.append(f)

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
                        self.global_locator.update(res["locator_map"])
                        self.pool_manager.register_book_count(
                            res["book_id"], 
                            res["valid_count"]
                        )
                        logger.info(f"   ✅ Processed: {fname} (Valid UIDs: {res['valid_count']})")
                    else:
                        logger.warning(f"   ⚠️ Worker failure: {fname}")
                except Exception as e:
                    logger.error(f"   ❌ Exception: {e}")

        self._save_uid_index()
        self.pool_manager.generate_js_constants() 

        logger.info("✨ Optimization Completed.")

    def _process_super(self, file_path: Path) -> None:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Map Locator cho các key đặc biệt trong Super Book (tpk, sutta...)
            meta = data.get("meta", {})
            for uid in meta.keys():
                self.global_locator[uid] = "tpk"

            # Super Book không có bài để random -> valid_count = 0
            # Nhưng vẫn register để biết nó tồn tại (và bị filter bởi IGNORED_IDS)
            self.pool_manager.register_book_count("tpk", 0)

            meta_pack = {
                "id": "tpk",
                "title": data.get("title"),
                "tree": data.get("structure"),
                "meta": meta,
                "uids": []
            }
            self.io.save_category("meta", "tpk.json", meta_pack)
            logger.info(f"   🌟 Super Book Processed")
            
        except Exception as e:
            logger.error(f"❌ Error super_book: {e}")

    def _save_uid_index(self) -> None:
        self.io.save_category("root", "uid_index.json", self.global_locator)

def run_optimizer(dry_run: bool = False):
    orchestrator = DBOrchestrator(dry_run)
    orchestrator.run()