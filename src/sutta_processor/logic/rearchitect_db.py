# Path: src/sutta_processor/logic/rearchitect_db.py
import json
import logging
import shutil
from pathlib import Path
from typing import Dict, Any, List, Set, Tuple

# Import cấu hình đường dẫn
from ..shared.app_config import PROCESSED_DIR, ASSETS_ROOT

logger = logging.getLogger("SuttaProcessor.Optimizer")

# Cấu hình Output
DB_DIR = ASSETS_ROOT / "db"
STRUCT_DIR = DB_DIR / "structure"
CONTENT_DIR = DB_DIR / "content"

# Ngưỡng cắt file (500KB)
CHUNK_SIZE_LIMIT = 500 * 1024 

class DBOptimizer:
    def __init__(self):
        self.locator: Dict[str, str] = {} # Mapping: uid -> filename (không đuôi)
        self.pools: Dict[str, List[str]] = {} # Pools cho random
        self.primary_books: Set[str] = {"dn", "mn", "sn", "an"}
        
    def _setup_directories(self):
        """Reset thư mục DB để đảm bảo sạch sẽ."""
        if DB_DIR.exists():
            shutil.rmtree(DB_DIR)
        
        DB_DIR.mkdir(parents=True)
        STRUCT_DIR.mkdir()
        CONTENT_DIR.mkdir()

    def _get_safe_name(self, relative_path: Path) -> str:
        """
        Chuyển path thành tên file phẳng an toàn.
        Input: sutta/mn_book.json
        Output: sutta_mn
        """
        # Bỏ đuôi _book.json và .json
        name = relative_path.name.replace("_book.json", "").replace(".json", "")
        
        # Lấy parent parts (trừ thư mục gốc) để ghép
        # Ví dụ path gốc là: .../data/processed/sutta/kn/dhp_book.json
        # relative so với PROCESSED_DIR là: sutta/kn/dhp_book.json
        # parts: ('sutta', 'kn', 'dhp_book.json')
        # Result: sutta_kn_dhp
        
        parts = list(relative_path.parent.parts)
        parts.append(name)
        
        return "_".join(parts)

    def _save_json(self, path: Path, data: Any):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

    def _process_content_chunks(self, safe_name: str, content: Dict[str, Any]) -> None:
        """Cắt content thành các chunk nhỏ."""
        chunk_idx = 1
        current_chunk: Dict[str, Any] = {}
        current_size = 0
        
        # Sắp xếp key để đảm bảo thứ tự
        sorted_keys = sorted(content.keys()) # Cần logic sort thông minh hơn nếu key phức tạp, tạm thời sort alpha
        
        for uid in sorted_keys:
            item_data = content[uid]
            item_str = json.dumps(item_data, ensure_ascii=False)
            item_size = len(item_str.encode('utf-8'))
            
            # Nếu chunk hiện tại + item mới vượt quá giới hạn VÀ chunk không rỗng
            if current_size + item_size > CHUNK_SIZE_LIMIT and current_chunk:
                # Ghi chunk cũ
                chunk_filename = f"{safe_name}_chunk_{chunk_idx}"
                self._save_json(CONTENT_DIR / f"{chunk_filename}.json", current_chunk)
                
                # Cập nhật index cho các UIDs trong chunk này
                for saved_uid in current_chunk.keys():
                    self.locator[saved_uid] = chunk_filename
                
                # Reset
                chunk_idx += 1
                current_chunk = {}
                current_size = 0
            
            # Thêm item vào chunk hiện tại
            current_chunk[uid] = item_data
            current_size += item_size
            
        # Ghi chunk cuối cùng nếu còn
        if current_chunk:
            chunk_filename = f"{safe_name}_chunk_{chunk_idx}"
            self._save_json(CONTENT_DIR / f"{chunk_filename}.json", current_chunk)
            for saved_uid in current_chunk.keys():
                self.locator[saved_uid] = chunk_filename

    def _process_book_file(self, file_path: Path):
        try:
            rel_path = file_path.relative_to(PROCESSED_DIR)
            safe_name = self._get_safe_name(rel_path)
            
            logger.info(f"   🔨 Processing: {safe_name}...")
            
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            # 1. Tách và Lưu Structure + Meta
            struct_data = {
                "id": data.get("id"),
                "title": data.get("title"),
                "structure": data.get("structure", {}),
                "meta": data.get("meta", {})
            }
            self._save_json(STRUCT_DIR / f"{safe_name}_struct.json", struct_data)
            
            # 2. Xử lý Content (Chunking)
            raw_content = data.get("content", {})
            if raw_content:
                self._process_content_chunks(safe_name, raw_content)
                
                # 3. Add to Pools (Chỉ lấy Leaf, không lấy Branch)
                # Ta check meta để biết cái nào là Leaf
                book_meta = data.get("meta", {})
                
                # Logic đơn giản: Nếu có trong content thì là Leaf/Content-bearing
                content_uids = list(raw_content.keys())
                
                # Add to 'all' pool
                if "all" not in self.pools: self.pools["all"] = []
                self.pools["all"].extend(content_uids)
                
                # Add to 'primary' pool (nếu thuộc dn, mn, sn, an)
                book_id = data.get("id", "").lower()
                if book_id in self.primary_books:
                    if "primary" not in self.pools: self.pools["primary"] = []
                    self.pools["primary"].extend(content_uids)
            
            # 4. Xử lý Shortcut (Sau khi đã có locator của content)
            # Shortcut không có content, nhưng cần locator trỏ về chunk chứa parent
            meta_map = data.get("meta", {})
            for uid, info in meta_map.items():
                if info.get("type") == "shortcut":
                    parent_uid = info.get("parent_uid")
                    if parent_uid and parent_uid in self.locator:
                        self.locator[uid] = self.locator[parent_uid]
                    else:
                        logger.warning(f"      ⚠️ Shortcut orphaned: {uid} -> {parent_uid} not found")

        except Exception as e:
            logger.error(f"❌ Failed to process {file_path.name}: {e}")

    def run(self):
        logger.info("🚀 Starting Database Optimization (Re-architecting)...")
        self._setup_directories()
        
        # Quét tất cả file json trong data/processed
        all_files = sorted(list(PROCESSED_DIR.rglob("*.json")))
        
        for f in all_files:
            if f.name == "super_book.json":
                # Xử lý riêng super book
                try:
                    with open(f, "r", encoding="utf-8") as sf:
                        sdata = json.load(sf)
                    self._save_json(STRUCT_DIR / "super_struct.json", sdata)
                    logger.info("   🌟 Processed Super Book -> super_struct.json")
                except Exception as e:
                    logger.error(f"❌ Error super_book: {e}")
                continue
                
            # Xử lý sách thường
            self._process_book_file(f)
            
        # Ghi Master Index
        master_index = {
            "pools": self.pools,
            "locator": self.locator
        }
        self._save_json(DB_DIR / "uid_index.json", master_index)
        
        logger.info(f"✅ Database Re-architected!")
        logger.info(f"   - Index: {len(self.locator)} entries")
        logger.info(f"   - Structure Files: {len(list(STRUCT_DIR.glob('*.json')))}")
        logger.info(f"   - Content Chunks: {len(list(CONTENT_DIR.glob('*.json')))}")

def run_optimizer():
    optimizer = DBOptimizer()
    optimizer.run()