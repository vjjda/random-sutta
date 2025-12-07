# Path: src/sutta_processor/optimizer/orchestrator.py
import json
import logging
import os
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Dict

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
        # Global Locator: uid -> book_id (Simple Map)
        self.global_locator: Dict[str, str] = {}

    def run(self) -> None:
        mode_str = "DRY-RUN" if self.dry_run else "PRODUCTION"
        logger.info(f"🚀 Starting Parallel Optimization (v3 - Split DB): {mode_str}")
        self.io.setup_directories()

        all_files = sorted(list(STAGE_PROCESSED_DIR.rglob("*.json")))
        book_files = []
        
        # 1. Super Book (tpk) - Xử lý riêng
        for f in all_files:
            if f.name == "super_book.json":
                self._process_super(f)
            else:
                book_files.append(f)

        # 2. Xử lý Sách (Parallel)
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
                        # Merge Locator: { "mn1": "mn" }
                        self.global_locator.update(res["locator_map"])
                        
                        # Register Count cho Weighted Random
                        self.pool_manager.register_book_count(
                            res["book_id"], 
                            res["valid_count"]
                        )
                        logger.info(f"   ✅ Processed: {fname} (Valid UIDs: {res['valid_count']})")
                    else:
                        logger.warning(f"   ⚠️ Worker failure: {fname}")
                except Exception as e:
                    logger.error(f"   ❌ Exception: {e}")

        # 3. Save Artifacts
        self._save_uid_index()
        
        if not self.dry_run:
            self.pool_manager.generate_js_constants()
        else:
            # Dry-run vẫn generate constants để debug, nhưng có thể log ra console hoặc lưu file tmp
            # Ở đây ta cứ lưu đè để check output
            self.pool_manager.generate_js_constants() 

        logger.info("✨ Optimization Completed.")

    def _process_super(self, file_path: Path) -> None:
        """Xử lý Tipitaka Root (tpk)."""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Super Book cũng là một Meta Pack đặc biệt
            meta_pack = {
                "id": "tpk",
                "title": data.get("title"),
                "tree": data.get("structure"),
                "meta": data.get("meta"), # Super meta thường nhỏ, giữ nguyên
                "uids": [] # Super không có bài để random
            }
            
            self.io.save_category("meta", "tpk.json", meta_pack)
            logger.info(f"   🌟 Super Book Processed")
            
        except Exception as e:
            logger.error(f"❌ Error super_book: {e}")

    def _save_uid_index(self) -> None:
        """Lưu file định tuyến uid_index.json"""
        # Đây giờ là file map đơn giản: { "mn1": "mn", ... }
        self.io.save_category("root", "uid_index.json", self.global_locator)