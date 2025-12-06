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

        # --- 1. Tách Metadata ---
        full_meta = data.get("meta", {})
        branch_meta = {} 
        leaf_meta = {}   

        for uid, info in full_meta.items():
            m_type = info.get("type")
            
            # A. Leaf/Shortcut -> Chunk
            if m_type != "branch" and m_type != "root":
                leaf_meta[uid] = info
                # [FIX PREV/NEXT TITLE]
                # Tạo bản sao rút gọn cho Structure để hiển thị Nav
                slim_info = info.copy()
                keys_to_remove = ["blurb", "author_uid", "scroll_target"]
                for k in keys_to_remove:
                    if k in slim_info: del slim_info[k]
                
                clean_info = {k: v for k, v in slim_info.items() if v is not None and v != ""}
                branch_meta[uid] = clean_info

            # B. Branch/Root -> Structure
            else:
                branch_meta[uid] = info
                # [CRITICAL FIX FOR BRANCH VIEW]
                # Thay vì lưu "structure", ta lưu tên file cụ thể để Client biết tải file nào
                result["locators"][uid] = f"{safe_name}_struct"

        # --- 2. Save Structure ---
        struct_data = {
            "id": data.get("id"),
            "title": data.get("title"),
            "structure": data.get("structure", {}),
            "meta": branch_meta 
        }
        io.save_dual(f"structure/{safe_name}_struct.json", struct_data)

        # --- 3. Process Content ---
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