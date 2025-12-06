# Path: src/sutta_processor/logic/rearchitect_db.py
import json
import logging
import shutil
from pathlib import Path
from typing import Dict, Any, List, Set

# Import cấu hình đường dẫn
from ..shared.app_config import PROCESSED_DIR, ASSETS_ROOT, PROJECT_ROOT

logger = logging.getLogger("SuttaProcessor.Optimizer")

WEB_DB_DIR = ASSETS_ROOT / "db"
MIRROR_DB_DIR = PROJECT_ROOT / "data" / "db_mirror"
CHUNK_SIZE_LIMIT = 500 * 1024 

class DBOptimizer:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.locator: Dict[str, str] = {} 
        
        # [UPDATED] Cấu trúc Pools mới theo yêu cầu
        self.pools: Dict[str, Any] = {
            "primary": [],  # List[str] - Chỉ chứa UID của 4 bộ chính
            "books": {}     # Dict[str, List[str]] - Phân loại theo từng sách (dn, mn, dhp...)
        }
        
        self.primary_books: Set[str] = {"dn", "mn", "sn", "an"}
        
    def _setup_directories(self):
        # ... (Giữ nguyên logic tạo thư mục như cũ) ...
        # 1. Clean Mirror DB
        if MIRROR_DB_DIR.exists():
            shutil.rmtree(MIRROR_DB_DIR)
        MIRROR_DB_DIR.mkdir(parents=True)
        (MIRROR_DB_DIR / "structure").mkdir()
        (MIRROR_DB_DIR / "content").mkdir()

        # 2. Clean Web DB (Only if not dry_run)
        if not self.dry_run:
            if WEB_DB_DIR.exists():
                shutil.rmtree(WEB_DB_DIR)
            WEB_DB_DIR.mkdir(parents=True)
            (WEB_DB_DIR / "structure").mkdir()
            (WEB_DB_DIR / "content").mkdir()
        else:
            logger.info("   🧪 Dry-run: Skipping Web DB write (assets/db)")

    def _get_safe_name(self, relative_path: Path) -> str:
        # ... (Giữ nguyên logic cũ) ...
        name = relative_path.name.replace("_book.json", "").replace(".json", "")
        parts = list(relative_path.parent.parts)
        parts.append(name)
        return "_".join(parts)

    def _save_dual(self, relative_path: str, data: Any):
        # ... (Giữ nguyên logic save dual như cũ) ...
        mirror_path = MIRROR_DB_DIR / relative_path
        try:
            with open(mirror_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"❌ Failed to write Mirror file {relative_path}: {e}")

        if not self.dry_run:
            web_path = WEB_DB_DIR / relative_path
            try:
                with open(web_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
            except Exception as e:
                logger.error(f"❌ Failed to write Web file {relative_path}: {e}")

    def _process_content_chunks(self, safe_name: str, content: Dict[str, Any]) -> None:
        # ... (Giữ nguyên logic chunking content như cũ) ...
        chunk_idx = 1
        current_chunk: Dict[str, Any] = {}
        current_size = 0
        sorted_keys = sorted(content.keys()) 
        
        for uid in sorted_keys:
            item_data = content[uid]
            item_str = json.dumps(item_data, ensure_ascii=False, separators=(',', ':'))
            item_size = len(item_str.encode('utf-8'))
            
            if current_size + item_size > CHUNK_SIZE_LIMIT and current_chunk:
                chunk_filename = f"{safe_name}_chunk_{chunk_idx}.json"
                self._save_dual(f"content/{chunk_filename}", current_chunk)
                for saved_uid in current_chunk.keys():
                    self.locator[saved_uid] = chunk_filename.replace(".json", "")
                
                chunk_idx += 1
                current_chunk = {}
                current_size = 0
            
            current_chunk[uid] = item_data
            current_size += item_size
            
        if current_chunk:
            chunk_filename = f"{safe_name}_chunk_{chunk_idx}.json"
            self._save_dual(f"content/{chunk_filename}", current_chunk)
            for saved_uid in current_chunk.keys():
                self.locator[saved_uid] = chunk_filename.replace(".json", "")

    def _process_book_file(self, file_path: Path):
        try:
            rel_path = file_path.relative_to(PROCESSED_DIR)
            safe_name = self._get_safe_name(rel_path)
            
            logger.info(f"   🔨 Processing: {safe_name}...")
            
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            # 1. Structure & Meta
            struct_data = {
                "id": data.get("id"),
                "title": data.get("title"),
                "structure": data.get("structure", {}),
                "meta": data.get("meta", {})
            }
            self._save_dual(f"structure/{safe_name}_struct.json", struct_data)
            
            # 2. Content Chunks
            raw_content = data.get("content", {})
            if raw_content:
                self._process_content_chunks(safe_name, raw_content)
                
                # [UPDATED] Logic Pools mới
                content_uids = list(raw_content.keys())
                book_id = data.get("id", "").lower() # ví dụ: 'mn', 'dhp', 'pli-tv-bi-pm'
                
                # A. Luôn thêm vào pool riêng của sách (books)
                if book_id:
                    if book_id not in self.pools["books"]:
                        self.pools["books"][book_id] = []
                    self.pools["books"][book_id].extend(content_uids)
                
                # B. Nếu là sách chính, thêm vào pool primary
                if book_id in self.primary_books:
                    self.pools["primary"].extend(content_uids)
            
            # 3. Shortcut Handling
            meta_map = data.get("meta", {})
            for uid, info in meta_map.items():
                if info.get("type") == "shortcut":
                    parent_uid = info.get("parent_uid")
                    if parent_uid and parent_uid in self.locator:
                        self.locator[uid] = self.locator[parent_uid]

        except Exception as e:
            logger.error(f"❌ Failed to process {file_path.name}: {e}")

    def run(self):
        mode_str = "DRY-RUN (Mirror Only)" if self.dry_run else "PRODUCTION (Dual Write)"
        logger.info(f"🚀 Starting Database Optimization: {mode_str}")
        self._setup_directories()
        
        all_files = sorted(list(PROCESSED_DIR.rglob("*.json")))
        
        for f in all_files:
            if f.name == "super_book.json":
                try:
                    with open(f, "r", encoding="utf-8") as sf:
                        sdata = json.load(sf)
                    self._save_dual("structure/super_struct.json", sdata)
                    logger.info("   🌟 Processed Super Book")
                except Exception as e:
                    logger.error(f"❌ Error super_book: {e}")
                continue
                
            self._process_book_file(f)
            
        master_index = {
            "pools": self.pools,
            "locator": self.locator
        }
        self._save_dual("uid_index.json", master_index)
        
        logger.info(f"✅ Database Re-architected!")
        logger.info(f"   👉 Mirror DB: {MIRROR_DB_DIR}")
        if not self.dry_run:
            logger.info(f"   👉 Web DB: {WEB_DB_DIR}")

def run_optimizer(dry_run: bool = False):
    optimizer = DBOptimizer(dry_run)
    optimizer.run()