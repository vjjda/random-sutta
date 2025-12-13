# Path: src/sutta_processor/optimizer/worker/process_book_workflow.py
import json
import logging
import traceback
from pathlib import Path
from typing import Dict, Any, Optional

from ..io_manager import IOManager
from ..tree_utils import (
    extract_nav_sequence, 
    generate_navigation_map, 
    generate_random_pool,
    generate_depth_navigation 
)
from ..splitter import is_split_book

from .handle_split_book_strategy import execute_split_book_strategy
from .handle_normal_book_strategy import execute_normal_book_strategy

logger = logging.getLogger("Optimizer.Worker")

def process_book_task(
    file_path: Path, 
    dry_run: bool, 
    external_nav: Optional[Dict[str, str]] = None,
    global_meta: Optional[Dict[str, Any]] = None # [NEW]
) -> Dict[str, Any]:
    """
    Workflow chính điều phối việc xử lý một cuốn sách.
    """
    io = IOManager(dry_run)
    result = { 
        "status": "error", 
        "book_id": "", 
        "valid_count": 0, 
        "locator_map": {}, 
        "sub_counts": {},
        "sub_books_list": [],
        "pool_data": {} 
    }

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        book_id = data.get("id", "").lower()
        result["book_id"] = book_id
        
        full_meta = data.get("meta", {})
        structure = data.get("structure", {})
        
        # 1. Nav Calculation (Internal)
        nav_sequence = extract_nav_sequence(structure, full_meta)
        linear_uids = generate_random_pool(nav_sequence)
        reading_nav_map = generate_navigation_map(nav_sequence)
        branch_nav_map = generate_depth_navigation(structure, full_meta)
        
        full_nav_map = {**branch_nav_map, **reading_nav_map}
        
        if external_nav:
            full_nav_map[book_id] = external_nav

        # 2. Dispatch Strategy (Truyền global_meta)
        if is_split_book(book_id):
            execute_split_book_strategy(
                book_id, data, full_meta, structure, full_nav_map, io, result, global_meta
            )
        else:
            execute_normal_book_strategy(
                book_id, data, full_meta, structure, full_nav_map, linear_uids, io, result, global_meta
            )

        result["status"] = "success"
        return result

    except Exception as e:
        logger.error(f"❌ Worker failed on {file_path.name}: {e}")
        traceback.print_exc()
        return result