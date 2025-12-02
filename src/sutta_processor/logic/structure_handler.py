# Path: src/sutta_processor/tree_utils.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Union

from .config import DATA_ROOT
from .types import SuttaMeta

logger = logging.getLogger("SuttaProcessor.Tree")

def load_original_tree(group_name: str) -> Dict[str, Any]:
    """Tải file tree gốc từ thư mục data."""
    book_id = group_name.split("/")[-1]
    tree_path = DATA_ROOT / "tree" / group_name / f"{book_id}-tree.json"
    
    if not tree_path.exists():
        # Fallback tìm kiếm
        found = list((DATA_ROOT / "tree").rglob(f"{book_id}-tree.json"))
        if found:
            tree_path = found[0]
        else:
            return {book_id: []}

    try:
        with open(tree_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"⚠️ Could not load tree for {book_id}: {e}")
        return {book_id: []}

def simplify_structure(node: Any) -> Any:
    """Loại bỏ các lớp bọc không cần thiết trong cấu trúc Tree."""
    if isinstance(node, list):
        # Nếu list chỉ chứa string (leaves), giữ nguyên
        if all(isinstance(x, str) for x in node):
            return node
        
        # Nếu list chứa dict, flatten nhẹ
        new_dict = {}
        for item in node:
            if isinstance(item, dict):
                for key, val in item.items():
                    new_dict[key] = simplify_structure(val)
        return new_dict
    
    elif isinstance(node, dict):
        return {k: simplify_structure(v) for k, v in node.items()}
    
    return node

def flatten_tree_leaves(node: Any) -> List[str]:
    """Trích xuất danh sách phẳng các UID (lá) từ Tree."""
    leaves = []
    if isinstance(node, str):
        return [node]
    elif isinstance(node, list):
        for child in node:
            leaves.extend(flatten_tree_leaves(child))
    elif isinstance(node, dict):
        for children in node.values():
            leaves.extend(flatten_tree_leaves(children))
    return leaves

def _add_meta_entry(uid: str, type_default: str, meta_map: Dict[str, SuttaMeta], target_dict: Dict[str, Any]) -> None:
    if uid not in target_dict:
        info = meta_map.get(uid, {}) # type: ignore
        target_dict[uid] = {
            "type": info.get("type", type_default),
            "acronym": info.get("acronym", ""),
            "translated_title": info.get("translated_title", ""),
            "original_title": info.get("original_title", ""),
            "blurb": info.get("blurb")
        }

def collect_meta_from_structure(node: Any, meta_map: Dict[str, SuttaMeta], target_dict: Dict[str, Any]) -> None:
    """Duyệt Tree và nhặt ra metadata cho từng node (nhánh và lá)."""
    if isinstance(node, str):
        _add_meta_entry(node, "leaf", meta_map, target_dict)
    elif isinstance(node, list):
        for child in node:
            collect_meta_from_structure(child, meta_map, target_dict)
    elif isinstance(node, dict):
        for uid, children in node.items():
            _add_meta_entry(uid, "branch", meta_map, target_dict)
            collect_meta_from_structure(children, meta_map, target_dict)

def build_book_data(
    group_name: str, 
    raw_data: Dict[str, Any], 
    names_map: Dict[str, SuttaMeta]
) -> Dict[str, Any]:
    """
    Hàm Factory: Tổng hợp Structure, Meta và Data thành object Book hoàn chỉnh.
    """
    # 1. Structure
    raw_tree = load_original_tree(group_name)
    structure = simplify_structure(raw_tree)

    # 2. Meta
    meta_dict: Dict[str, Any] = {}
    collect_meta_from_structure(structure, names_map, meta_dict)
    
    # Bổ sung meta cho các bài kinh lẻ (nếu không nằm trong tree)
    for sid in raw_data.keys():
        if sid not in meta_dict:
            _add_meta_entry(sid, "leaf", names_map, meta_dict)

    # 3. Data Ordering (Theo Tree)
    ordered_leaves = flatten_tree_leaves(structure)
    data_dict = {}
    
    # Add data theo thứ tự Tree
    for uid in ordered_leaves:
        if uid in raw_data:
            data_dict[uid] = raw_data[uid]
    
    # Add data còn sót (orphan)
    for uid, content in raw_data.items():
        if uid not in data_dict:
            data_dict[uid] = content

    book_id = group_name.split("/")[-1]
    book_meta = names_map.get(book_id, {}) # type: ignore

    return {
        "id": book_id,
        "title": book_meta.get("translated_title", book_id.upper()),
        "structure": structure,
        "meta": meta_dict,
        "data": data_dict
    }