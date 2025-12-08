# Path: src/sutta_processor/optimizer/worker/process_book_workflow.py
import json
import logging
import traceback
from pathlib import Path
from typing import Dict, Any

from ..io_manager import IOManager
from ..tree_utils import flatten_tree_uids, build_nav_map
from ..splitter import is_split_book

# Explicit Imports (Tên file rõ ràng)
from .handle_split_book_strategy import execute_split_book_strategy
from .handle_normal_book_strategy import execute_normal_book_strategy

logger = logging.getLogger("Optimizer.Worker")

def process_book_task(file_path: Path, dry_run: bool) -> Dict[str, Any]:
    """
    Workflow chính điều phối việc xử lý một cuốn sách.
    1. Load dữ liệu thô.
    2. Tính toán Navigation & Linear Pool chung.
    3. Điều hướng sang Strategy phù hợp (Split hoặc Normal).
    """
    io = IOManager(dry_run)
    result = { 
        "status": "error", 
        "book_id": "", 
        "valid_count": 0, 
        "locator_map": {}, 
        "sub_counts": {},
        "sub_books_list": []
    }

    try:
        # 1. Load Data
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        book_id = data.get("id", "").lower()
        result["book_id"] = book_id
        
        full_meta = data.get("meta", {})
        structure = data.get("structure", {})
        
        # 2. Shared Calculations (Nav & Random Pool Order)
        linear_uids = []
        flatten_tree_uids(structure, full_meta, linear_uids)
        nav_map = build_nav_map(linear_uids)
        
        # 3. Dispatch to specific Strategy
        if is_split_book(book_id):
            execute_split_book_strategy(
                book_id, data, full_meta, structure, nav_map, io, result
            )
        else:
            execute_normal_book_strategy(
                book_id, data, full_meta, structure, nav_map, linear_uids, io, result
            )

        result["status"] = "success"
        return result

    except Exception as e:
        logger.error(f"❌ Worker failed on {file_path.name}: {e}")
        traceback.print_exc()
        return result