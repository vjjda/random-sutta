# Path: src/sutta_processor/optimizer/orchestrator.py
import json
import logging
import os
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Any, Set

from ..shared.app_config import STAGE_PROCESSED_DIR
from .io_manager import IOManager
from .pool_manager import PoolManager
from .worker import process_book_task
# [NEW] Import logic tính nav
from .tree_utils import generate_depth_navigation

logger = logging.getLogger("Optimizer.Main")

class DBOrchestrator:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.io = IOManager(dry_run)
        self.pool_manager = PoolManager()
        self.global_locator: Dict[str, List[Any]] = {}
        # [NEW] Lưu trữ bản đồ điều hướng toàn cục (từ Super Book)
        self.super_nav_map: Dict[str, Dict[str, str]] = {}

    def run(self) -> None:
        mode_str = "DRY-RUN" if self.dry_run else "PRODUCTION"
        logger.info(f"🚀 Starting Parallel Optimization (v6.3 - Global Nav Inheritance): {mode_str}")
        self.io.setup_directories()

        all_files = sorted(list(STAGE_PROCESSED_DIR.rglob("*.json")))
        book_files = []
        
        # 1. Tách Super Book ra để xử lý TRƯỚC
        for f in all_files:
            if f.name == "super_book.json":
                self._process_super(f)
            else:
                book_files.append(f)

        max_workers = min(os.cpu_count() or 4, 8)
        
        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            futures = {}
            
            for f in book_files:
                # [NEW] Xác định ID sách từ tên file (vd: mn_book.json -> mn)
                # Để tìm xem nó có Nav trong bản đồ tổng thể không
                book_id_guess = f.name.replace("_book.json", "")
                external_nav = self.super_nav_map.get(book_id_guess)
                
                # Truyền external_nav vào worker
                futures[executor.submit(process_book_task, f, self.dry_run, external_nav)] = f.name

            for future in as_completed(futures):
                fname = futures[future]
                try:
                    res = future.result()
                    if res["status"] == "success":
                        self.global_locator.update(res["locator_map"])
                        
                        self.pool_manager.register_book_count(
                            res["book_id"], 
                            res["valid_count"],
                            res.get("sub_counts")
                        )
                        
                        if res.get("sub_books_list"):
                            self.pool_manager.register_group_structure(
                                res["book_id"], 
                                res["sub_books_list"]
                            )
                            
                        logger.info(f"   ✅ Processed: {fname}")
                    else:
                        logger.warning(f"   ⚠️ Worker failure: {fname}")
                except Exception as e:
                    logger.error(f"   ❌ Exception: {e}")

        self._save_uid_index()
        self.pool_manager.generate_js_constants() 

        logger.info("✨ Optimization Completed.")

    def _extract_sutta_books(self, structure: Any) -> List[str]:
        # (Giữ nguyên hàm này từ code cũ)
        sutta_books: Set[str] = set()
        def _find_sutta_root(node):
            if isinstance(node, dict):
                if "sutta" in node: return node["sutta"]
                for v in node.values():
                    res = _find_sutta_root(v)
                    if res: return res
            elif isinstance(node, list):
                for item in node:
                    res = _find_sutta_root(item)
                    if res: return res
            return None

        def _collect_leaves(node):
            if isinstance(node, str):
                sutta_books.add(node)
            elif isinstance(node, list):
                for item in node:
                    _collect_leaves(item)
            elif isinstance(node, dict):
                for v in node.values():
                    _collect_leaves(v)

        sutta_root = _find_sutta_root(structure)
        if sutta_root:
            _collect_leaves(sutta_root)
        return list(sutta_books)

    def _process_super(self, file_path: Path) -> None:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            structure = data.get("structure", {})
            sutta_books = self._extract_sutta_books(structure)
            self.pool_manager.set_sutta_universe(sutta_books)

            meta = data.get("meta", {})
            
            # [NEW] Tính toán Nav cho Super Tree (Branch Nav)
            # Hàm generate_depth_navigation sẽ tạo link cho dn <-> mn <-> sn...
            self.super_nav_map = generate_depth_navigation(structure, meta)
            
            # Inject Nav vào chính Meta của Super Book (tpk.json)
            for uid, nav_entry in self.super_nav_map.items():
                if uid in meta:
                    meta[uid]["nav"] = nav_entry

            # Locator cho tpk
            for uid in meta.keys():
                self.global_locator[uid] = ["tpk", None]

            self.pool_manager.register_book_count("tpk", 0)

            meta_pack = {
                "id": "tpk",
                "title": data.get("title"),
                "tree": structure,
                "meta": meta,
                "random_pool": []
            }
            self.io.save_category("meta", "tpk.json", meta_pack)
            logger.info(f"   🌟 Super Book Processed (Generated Nav for {len(self.super_nav_map)} items)")
            
        except Exception as e:
            logger.error(f"❌ Error super_book: {e}")

    def _save_uid_index(self) -> None:
        self.io.save_category("root", "uid_index.json", self.global_locator)

def run_optimizer(dry_run: bool = False):
    orchestrator = DBOrchestrator(dry_run)
    orchestrator.run()