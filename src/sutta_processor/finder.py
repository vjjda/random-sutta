# Path: src/sutta_processor/finder.py
import logging
import json
import os
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

from .config import DATA_ROOT

logger = logging.getLogger("SuttaProcessor")

# ... (Các hàm _identify_book_group_from_tree, _extract_leaves_from_tree, _build_root_file_index giữ nguyên) ...
# Chỉ sửa hàm generate_book_tasks

def generate_book_tasks(meta_map: Dict[str, Any]) -> Dict[str, List[Tuple[str, Path, Optional[str]]]]:
    """
    Tạo danh sách task.
    Mỗi task: (sutta_id, root_path, author_uid)
    """
    tree_dir = DATA_ROOT / "tree"
    if not tree_dir.exists():
        raise FileNotFoundError(f"Tree directory missing: {tree_dir}")

    # 1. Index Root Files
    file_index = _build_root_file_index()
    
    logger.info(f"🌲 Scanning Tree files...")
    
    book_tasks = {}
    total_suttas = 0
    
    tree_files = sorted(list(tree_dir.rglob("*-tree.json")))
    
    for tree_file in tree_files:
        if tree_file.name == "super-tree.json":
            continue
            
        group_id = _identify_book_group_from_tree(tree_file)
        
        try:
            with open(tree_file, "r", encoding="utf-8") as f:
                tree_data = json.load(f)
            
            ordered_uids = _extract_leaves_from_tree(tree_data)
            
            tasks = []
            for uid in ordered_uids:
                # Chỉ xử lý nếu có file root Pali
                if uid in file_index:
                    root_path = file_index[uid]
                    
                    # Lấy thông tin dịch giả từ Metadata (nếu có)
                    author_uid = None
                    if uid in meta_map:
                        author_uid = meta_map[uid].get("best_author_uid")
                    
                    tasks.append((uid, root_path, author_uid))
            
            if tasks:
                book_tasks[group_id] = tasks
                total_suttas += len(tasks)
                
        except Exception as e:
            logger.error(f"Error parsing tree {tree_file.name}: {e}")

    # Inject Extra Books (Vinaya PM) - Giữ nguyên logic cũ
    # (Bạn nhớ copy lại đoạn EXTRA_BOOKS và logic inject từ phiên bản trước vào đây nhé)
    
    logger.info(f"✅ Generated tasks for {total_suttas} suttas.")
    return book_tasks

# --- Helper functions cũ cần giữ lại ---
def _build_root_file_index() -> Dict[str, Path]:
    logger.info("⚡ Indexing root files...")
    root_dir = DATA_ROOT / "root"
    index = {}
    if not root_dir.exists(): return index
    for file_path in root_dir.rglob("*_root-*.json"):
        if file_path.is_file():
            sutta_id = file_path.name.split("_")[0]
            index[sutta_id] = file_path
    return index

def _identify_book_group_from_tree(tree_file: Path) -> str:
    try:
        base_tree = DATA_ROOT / "tree"
        rel_path = tree_file.relative_to(base_tree)
        parent = rel_path.parent
        book_id = tree_file.name.replace("-tree.json", "")
        return f"{parent}/{book_id}"
    except Exception:
        return "uncategorized"

def _extract_leaves_from_tree(node: Any) -> List[str]:
    leaves = []
    if isinstance(node, str): return [node]
    elif isinstance(node, list):
        for child in node: leaves.extend(_extract_leaves_from_tree(child))
    elif isinstance(node, dict):
        for key, children in node.items(): leaves.extend(_extract_leaves_from_tree(children))
    return leaves