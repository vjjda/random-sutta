# Path: src/sutta_processor/optimizer/orchestrator.py
import json
import logging
import os
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Any

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
        logger.info(f"🚀 Starting Parallel Optimization (v3.1 - BugFix): {mode_str}")
        self.io.setup_directories()

        all_files = sorted(list(STAGE_PROCESSED_DIR.rglob("*.json")))
        book_files = []
        
        # 1. Super Book (tpk)
        for f in all_files:
            if f.name == "super_book.json":
                self._process_super(f)
            else:
                book_files.append(f)

        # 2. Xử lý Sách
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

        # 3. Save Artifacts
        self._save_uid_index()
        self.pool_manager.generate_js_constants() 

        logger.info("✨ Optimization Completed.")

    def _extract_sutta_books(self, structure: Any) -> List[str]:
        """Trích xuất danh sách sách nằm trong nhánh 'sutta' của Tipitaka."""
        sutta_books = []
        
        def _traverse(node):
            if isinstance(node, dict):
                for k, v in node.items():
                    # Nếu value là list uids -> k là tên sách (leaf của tree sách)
                    # Tuy nhiên ở super tree, value thường là list children (struct)
                    # Ta coi key là sách nếu nó không phải là các group lớn như 'dn', 'mn' (nhưng logic này lỏng lẻo)
                    # Tốt nhất: Lấy tất cả Key nằm dưới nhánh 'sutta'
                    sutta_books.append(k)
                    _traverse(v)
            elif isinstance(node, list):
                for item in node:
                    _traverse(item)
        
        # Structure: { "tpk": { "sutta": { "dn": ..., "kn": { "dhp": ... } } } }
        # Ta cần tìm node "sutta" trước
        
        # Helper để tìm node theo key
        def _find_node(root, target_key):
            if isinstance(root, dict):
                if target_key in root: return root[target_key]
                for v in root.values():
                    res = _find_node(v, target_key)
                    if res: return res
            return None

        sutta_node = _find_node(structure, "sutta")
        if sutta_node:
            _traverse(sutta_node)
            
        return sutta_books

    def _process_super(self, file_path: Path) -> None:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # 1. Trích xuất danh sách Sutta cho PoolManager
            structure = data.get("structure", {})
            sutta_books = self._extract_sutta_books(structure)
            self.pool_manager.set_sutta_universe(sutta_books)

            # 2. Save Meta
            meta_pack = {
                "id": "tpk",
                "title": data.get("title"),
                "tree": structure,
                "meta": data.get("meta"),
                "uids": []
            }
            self.io.save_category("meta", "tpk.json", meta_pack)
            logger.info(f"   🌟 Super Book Processed (Found {len(sutta_books)} Sutta Books)")
            
        except Exception as e:
            logger.error(f"❌ Error super_book: {e}")
            import traceback
            traceback.print_exc()

    def _save_uid_index(self) -> None:
        self.io.save_category("root", "uid_index.json", self.global_locator)

def run_optimizer(dry_run: bool = False):
    orchestrator = DBOrchestrator(dry_run)
    orchestrator.run()