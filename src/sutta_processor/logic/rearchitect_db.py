# Path: src/sutta_processor/logic/rearchitect_db.py
import json
import logging
import shutil
from pathlib import Path
from typing import Dict, Any, List, Set

# Import cấu hình đường dẫn
from ..shared.app_config import PROCESSED_DIR, ASSETS_ROOT, PROJECT_ROOT

logger = logging.getLogger("SuttaProcessor.Optimizer")

# 1. Cấu hình Output Web (Production - Minified)
WEB_DB_DIR = ASSETS_ROOT / "db"

# 2. Cấu hình Output Mirror (Dev - Human Readable)
MIRROR_DB_DIR = PROJECT_ROOT / "data" / "db_mirror"

# Ngưỡng cắt file (500KB)
CHUNK_SIZE_LIMIT = 500 * 1024 

class DBOptimizer:
    def __init__(self):
        self.locator: Dict[str, str] = {} 
        self.pools: Dict[str, List[str]] = {}
        self.primary_books: Set[str] = {"dn", "mn", "sn", "an"}
        
    def _setup_directories(self):
        """Reset cả 2 thư mục DB để đảm bảo sạch sẽ."""
        # 1. Clean Web DB
        if WEB_DB_DIR.exists():
            shutil.rmtree(WEB_DB_DIR)
        WEB_DB_DIR.mkdir(parents=True)
        (WEB_DB_DIR / "structure").mkdir()
        (WEB_DB_DIR / "content").mkdir()

        # 2. Clean Mirror DB
        if MIRROR_DB_DIR.exists():
            shutil.rmtree(MIRROR_DB_DIR)
        MIRROR_DB_DIR.mkdir(parents=True)
        (MIRROR_DB_DIR / "structure").mkdir()
        (MIRROR_DB_DIR / "content").mkdir()

    def _get_safe_name(self, relative_path: Path) -> str:
        """Chuyển path thành tên file phẳng an toàn (giữ nguyên logic cũ)."""
        name = relative_path.name.replace("_book.json", "").replace(".json", "")
        parts = list(relative_path.parent.parts)
        parts.append(name)
        return "_".join(parts)

    def _save_dual(self, relative_path: str, data: Any):
        """
        Lưu file vào cả 2 nơi với định dạng khác nhau.
        relative_path: ví dụ 'uid_index.json' hoặc 'structure/sutta_mn_struct.json'
        """
        # 1. Write Web Version (Minified, Optimized)
        web_path = WEB_DB_DIR / relative_path
        try:
            with open(web_path, "w", encoding="utf-8") as f:
                # separators=(',', ':') loại bỏ khoảng trắng thừa -> file nhỏ nhất
                json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        except Exception as e:
            logger.error(f"❌ Failed to write Web file {relative_path}: {e}")

        # 2. Write Mirror Version (Pretty Print)
        mirror_path = MIRROR_DB_DIR / relative_path
        try:
            with open(mirror_path, "w", encoding="utf-8") as f:
                # indent=2 -> Dễ đọc cho con người check
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"❌ Failed to write Mirror file {relative_path}: {e}")

    def _process_content_chunks(self, safe_name: str, content: Dict[str, Any]) -> None:
        chunk_idx = 1
        current_chunk: Dict[str, Any] = {}
        current_size = 0
        
        sorted_keys = sorted(content.keys()) 
        
        for uid in sorted_keys:
            item_data = content[uid]
            # Tính size dựa trên minified string để cắt cho chuẩn
            item_str = json.dumps(item_data, ensure_ascii=False, separators=(',', ':'))
            item_size = len(item_str.encode('utf-8'))
            
            if current_size + item_size > CHUNK_SIZE_LIMIT and current_chunk:
                chunk_filename = f"{safe_name}_chunk_{chunk_idx}.json"
                # Save Dual
                self._save_dual(f"content/{chunk_filename}", current_chunk)
                
                for saved_uid in current_chunk.keys():
                    # Locator chỉ cần tên file (bỏ đuôi .json để tiết kiệm bytes trong index)
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
                
                # 3. Add to Pools
                content_uids = list(raw_content.keys())
                if "all" not in self.pools: self.pools["all"] = []
                self.pools["all"].extend(content_uids)
                
                book_id = data.get("id", "").lower()
                if book_id in self.primary_books:
                    if "primary" not in self.pools: self.pools["primary"] = []
                    self.pools["primary"].extend(content_uids)
            
            # 4. Shortcut Handling
            meta_map = data.get("meta", {})
            for uid, info in meta_map.items():
                if info.get("type") == "shortcut":
                    parent_uid = info.get("parent_uid")
                    if parent_uid and parent_uid in self.locator:
                        self.locator[uid] = self.locator[parent_uid]

        except Exception as e:
            logger.error(f"❌ Failed to process {file_path.name}: {e}")

    def run(self):
        logger.info("🚀 Starting Database Optimization (Dual-Mode)...")
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
        logger.info(f"   👉 Web DB: {WEB_DB_DIR}")
        logger.info(f"   👉 Mirror DB: {MIRROR_DB_DIR}")

def run_optimizer():
    optimizer = DBOptimizer()
    optimizer.run()