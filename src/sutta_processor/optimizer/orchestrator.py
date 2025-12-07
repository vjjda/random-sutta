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

logger = logging.getLogger("Optimizer.Main")

class DBOrchestrator:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.io = IOManager(dry_run)
        self.pool_manager = PoolManager()
        self.global_locator: Dict[str, str] = {}

    def run(self) -> None:
        mode_str = "DRY-RUN" if self.dry_run else "PRODUCTION"
        logger.info(f"🚀 Starting Parallel Optimization (v5 - Refactored Worker): {mode_str}")
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

    def _extract_sutta_books(self, structure: Any) -> List[str]:
        """
        Trích xuất danh sách sách thuộc 'sutta'.
        Dựa vào cấu trúc super_book.json bạn cung cấp:
        tpk -> [ { "sutta": [ {"long": ["dn"]}, {"minor": [{"kn": ["dhp", ...]}]} ] } ]
        """
        sutta_books: Set[str] = set()
        
        # 1. Tìm node "sutta"
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

        # 2. Thu thập "Book ID" (Leaf của cây Category)
        # Trong structure của bạn: dn, mn, sn, an là value string trong list.
        # Nhưng kp, dhp lại nằm trong list của "kn".
        def _collect_books(node):
            if isinstance(node, str):
                sutta_books.add(node)
            elif isinstance(node, list):
                for item in node:
                    _collect_books(item)
            elif isinstance(node, dict):
                for v in node.values():
                    _collect_books(v)

        sutta_root = _find_sutta_root(structure)
        if sutta_root:
            _collect_books(sutta_root)
            
        # Loại bỏ các key nhóm (long, middle, minor, kn...) nếu chúng lọt vào
        # Nhưng trong cấu trúc bạn đưa, key nhóm là Key của Dict, còn sách là Value (String hoặc List)
        # Hàm _collect_books ở trên đệ quy vào Value nên sẽ lấy được 'dn', 'mn', 'dhp'.
        # Key 'long', 'minor' sẽ bị bỏ qua vì chúng là Key.
        # Tuy nhiên, cần lưu ý cấu trúc { "long": ["dn"] }. _collect_books duyệt values -> ["dn"] -> "dn". Đúng.
        
        return list(sutta_books)

    def _process_super(self, file_path: Path) -> None:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            structure = data.get("structure", {})
            sutta_books = self._extract_sutta_books(structure)
            self.pool_manager.set_sutta_universe(sutta_books)

            # Map Locator cho các key đặc biệt trong Super Book (tpk, sutta, vinaya...)
            meta = data.get("meta", {})
            for uid in meta.keys():
                self.global_locator[uid] = "tpk"

            self.pool_manager.register_book_count("tpk", 0)

            meta_pack = {
                "id": "tpk",
                "title": data.get("title"),
                "tree": structure,
                "meta": meta,
                "uids": []
            }
            self.io.save_category("meta", "tpk.json", meta_pack)
            logger.info(f"   🌟 Super Book Processed (Found {len(sutta_books)} Sutta Candidates)")
            
        except Exception as e:
            logger.error(f"❌ Error super_book: {e}")

    def _save_uid_index(self) -> None:
        self.io.save_category("root", "uid_index.json", self.global_locator)

def run_optimizer(dry_run: bool = False):
    orchestrator = DBOrchestrator(dry_run)
    orchestrator.run()