# Path: src/sutta_processor/optimizer/worker.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List

from ..shared.app_config import STAGE_PROCESSED_DIR
from .io_manager import IOManager
from .chunker import chunk_content_with_meta
from .pool_manager import PoolManager

logger = logging.getLogger("Optimizer.Worker")

def process_book_task(file_path: Path, dry_run: bool) -> Dict[str, Any]:
    io = IOManager(dry_run)
    result = {
        "status": "error", 
        "book_id": "", 
        "valid_uids": [], 
        "locators": {}
    }

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        rel_path = file_path.relative_to(STAGE_PROCESSED_DIR)
        safe_name = io.get_safe_name(rel_path)
        book_id = data.get("id", "").lower()
        result["book_id"] = book_id

        # --- 1. Tách Metadata (Hybrid Approach) ---
        full_meta = data.get("meta", {})
        branch_meta = {} # Dành cho Structure File (Lightweight)
        leaf_meta = {}   # Dành cho Chunk File (Full detail)

        for uid, info in full_meta.items():
            m_type = info.get("type")
            
            # A. Build Leaf Meta (Full) cho Chunk
            # Chỉ Leaf và Shortcut mới cần đi theo content
            if m_type != "branch" and m_type != "root":
                leaf_meta[uid] = info

            # B. Build Branch Meta (Structure)
            if m_type == "branch" or m_type == "root":
                # Branch giữ nguyên (vì nó định nghĩa cấu trúc)
                branch_meta[uid] = info
            else:
                # [FIX] Leaf/Shortcut: Tạo bản sao RÚT GỌN cho Structure
                # Giữ lại Title/Acronym để hiển thị Nav
                # Loại bỏ 'blurb' (nặng nhất) và các trường kỹ thuật không cần cho Nav
                slim_info = info.copy()
                if "blurb" in slim_info:
                    del slim_info["blurb"]
                # Có thể bỏ thêm author_uid nếu muốn tiết kiệm thêm
                
                branch_meta[uid] = slim_info
                
            # Locator cho Branch vẫn trỏ về structure
            if m_type == "branch" or m_type == "root":
                result["locators"][uid] = "structure"

        # --- 2. Save Structure (Bây giờ đã chứa Slim Leaf Meta) ---
        struct_data = {
            "id": data.get("id"),
            "title": data.get("title"),
            "structure": data.get("structure", {}),
            "meta": branch_meta 
        }
        io.save_dual(f"structure/{safe_name}_struct.json", struct_data)

        # --- 3. Process Content & Full Leaf Meta ---
        raw_content = data.get("content", {})
        
        if raw_content:
            chunks = chunk_content_with_meta(safe_name, raw_content, leaf_meta)
            
            for fname, chunk_data in chunks:
                io.save_dual(f"content/{fname}.json", chunk_data)
                for uid in chunk_data.keys():
                    result["locators"][uid] = fname

            result["valid_uids"] = PoolManager.filter_smart_uids(raw_content, full_meta)

        result["status"] = "success"
        return result

    except Exception as e:
        logger.error(f"❌ Worker failed on {file_path.name}: {e}")
        return result