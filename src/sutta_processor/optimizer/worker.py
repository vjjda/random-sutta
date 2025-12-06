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

        # --- 1. Tách Metadata (Ultra Slim Approach) ---
        full_meta = data.get("meta", {})
        branch_meta = {} # Dành cho Structure File (Siêu nhẹ)
        leaf_meta = {}   # Dành cho Chunk File (Full detail)

        for uid, info in full_meta.items():
            m_type = info.get("type")
            
            # A. Build Leaf Meta (Full) cho Chunk
            if m_type != "branch" and m_type != "root":
                leaf_meta[uid] = info

            # B. Build Branch Meta (Structure)
            if m_type == "branch" or m_type == "root":
                # Branch: Giữ nguyên để hiển thị tiêu đề chương/phẩm
                # Có thể cân nhắc bỏ blurb của Branch nếu muốn nhẹ hơn nữa
                branch_meta[uid] = info
            else:
                # [FIX - ULTRA SLIM] Leaf/Shortcut
                # Chỉ giữ lại NHỮNG GÌ TỐI THIỂU để hiển thị Navigation Bar
                # Bỏ original_title (Pali), Bỏ blurb, Bỏ author...
                slim_info = {
                    "acronym": info.get("acronym", ""),
                    "translated_title": info.get("translated_title", ""),
                    "type": m_type 
                    # type cần thiết để FE phân biệt shortcut/leaf
                }
                
                # Nếu là Shortcut, cần giữ parent_uid để FE map logic
                if m_type == "shortcut":
                    slim_info["parent_uid"] = info.get("parent_uid")

                branch_meta[uid] = slim_info
                
            if m_type == "branch" or m_type == "root":
                result["locators"][uid] = "structure"

        # --- 2. Save Structure ---
        # Structure Tree thường rất gọn (chỉ là nested keys), 
        # vấn đề chính nằm ở Meta Object khổng lồ.
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