# Path: src/sutta_processor/optimizer/worker.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List

from ..shared.app_config import STAGE_PROCESSED_DIR
from .io_manager import IOManager
from .chunker import chunk_content_with_meta # [UPDATED]
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
        leaf_meta = {} # Bao gồm cả Leaf và Shortcut

        for uid, info in full_meta.items():
            m_type = info.get("type")
            # Branch giữ lại ở Structure
            if m_type == "branch" or m_type == "root": 
                branch_meta[uid] = info
                # [Locator] Branch nằm trong structure
                result["locators"][uid] = "structure" 
            else:
                # Leaf/Shortcut đẩy sang Chunk
                leaf_meta[uid] = info

        # --- 2. Save Structure (Slim version) ---
        struct_data = {
            "id": data.get("id"),
            "title": data.get("title"),
            "structure": data.get("structure", {}),
            "meta": branch_meta # Chỉ chứa Branch Meta
        }
        io.save_dual(f"structure/{safe_name}_struct.json", struct_data)

        # --- 3. Process Content & Leaf Meta ---
        raw_content = data.get("content", {})
        
        if raw_content:
            # A. Chunking (Content + Leaf Meta)
            chunks = chunk_content_with_meta(safe_name, raw_content, leaf_meta)
            
            for fname, chunk_data in chunks:
                io.save_dual(f"content/{fname}.json", chunk_data)
                
                # Map Locator cho tất cả item trong chunk
                for uid in chunk_data.keys():
                    result["locators"][uid] = fname

            # C. Smart Pool Filtering
            result["valid_uids"] = PoolManager.filter_smart_uids(raw_content, full_meta)

        result["status"] = "success"
        return result

    except Exception as e:
        logger.error(f"❌ Worker failed on {file_path.name}: {e}")
        return result