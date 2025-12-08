# Path: src/sutta_processor/optimizer/worker/process_book_workflow.py
import json
import logging
import traceback
from pathlib import Path
from typing import Dict, Any

from ..io_manager import IOManager
# [FIXED] Removed 'build_nav_map' from imports
from ..tree_utils import extract_nav_sequence, generate_navigation_map, generate_random_pool
from ..splitter import is_split_book

from .handle_split_book_strategy import execute_split_book_strategy
from .handle_normal_book_strategy import execute_normal_book_strategy

logger = logging.getLogger("Optimizer.Worker")

def process_book_task(file_path: Path, dry_run: bool) -> Dict[str, Any]:
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
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        book_id = data.get("id", "").lower()
        result["book_id"] = book_id
        
        full_meta = data.get("meta", {})
        structure = data.get("structure", {})
        
        # [UPDATED LOGIC]
        # 1. Trích xuất trình tự đọc (Sequence) - Dual Layer
        nav_sequence = extract_nav_sequence(structure, full_meta)
        
        # 2. Tạo Random Pool (Phẳng hóa từ sequence)
        linear_uids = generate_random_pool(nav_sequence)
        
        # 3. Tạo Nav Map (Luồng kép: Backbone + Deep Dive)
        nav_map = generate_navigation_map(nav_sequence)
        
        # 4. Dispatch strategy
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