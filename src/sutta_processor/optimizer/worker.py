# Path: src/sutta_processor/optimizer/worker.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple

from ..shared.app_config import PROCESSED_DIR
from .io_manager import IOManager
from .chunker import chunk_content
from .pool_manager import PoolManager

# Logger trong worker process cần setup lại nếu muốn hiện ra console, 
# nhưng thường logger gốc vẫn capture được stderr.
logger = logging.getLogger("Optimizer.Worker")

def process_book_task(file_path: Path, dry_run: bool) -> Dict[str, Any]:
    """
    Hàm chạy trong Process riêng.
    Trả về: {
        "status": "success",
        "book_id": str,
        "valid_uids": List[str],
        "locators": Dict[str, str]  # mapping uid -> chunk_file
    }
    """
    io = IOManager(dry_run)
    result = {
        "status": "error", 
        "book_id": "", 
        "valid_uids": [], 
        "locators": {}
    }

    try:
        # 1. Load Data
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        rel_path = file_path.relative_to(PROCESSED_DIR)
        safe_name = io.get_safe_name(rel_path)
        book_id = data.get("id", "").lower()
        result["book_id"] = book_id

        # 2. Save Structure
        struct_data = {
            "id": data.get("id"),
            "title": data.get("title"),
            "structure": data.get("structure", {}),
            "meta": data.get("meta", {})
        }
        io.save_dual(f"structure/{safe_name}_struct.json", struct_data)

        # 3. Process Content
        raw_content = data.get("content", {})
        meta_map = data.get("meta", {})
        
        if raw_content:
            # A. Chunking
            chunks = chunk_content(safe_name, raw_content)
            for fname, content in chunks:
                # Save chunk file
                io.save_dual(f"content/{fname}.json", content)
                # Map Locator
                for uid in content.keys():
                    result["locators"][uid] = fname

            # B. Map Shortcuts (Locators)
            for uid, info in meta_map.items():
                if info.get("type") == "shortcut":
                    parent = info.get("parent_uid")
                    if parent and parent in result["locators"]:
                        result["locators"][uid] = result["locators"][parent]

            # C. Smart Pool Filtering
            result["valid_uids"] = PoolManager.filter_smart_uids(raw_content, meta_map)

        result["status"] = "success"
        return result

    except Exception as e:
        logger.error(f"❌ Worker failed on {file_path.name}: {e}")
        return result