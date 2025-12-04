# Path: src/sutta_processor/logic/structure_handler.py
import json
import logging
from typing import Dict, Any, List

from ..shared.app_config import DATA_ROOT
from ..shared.domain_types import SuttaMeta

logger = logging.getLogger("SuttaProcessor.Logic.Structure")

def load_original_tree(group_name: str) -> Dict[str, Any]:
    # ... (Giữ nguyên hàm này)
    book_id = group_name.split("/")[-1]
    tree_path = DATA_ROOT / "tree" / group_name / f"{book_id}-tree.json"
    
    if not tree_path.exists():
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
    """
    Đơn giản hóa cấu trúc cây JSON.
    - List[String] -> Giữ nguyên.
    - List[Mixed] -> Giữ nguyên là List (FIX: để không mất leaf siblings).
    - List[Dict] -> Gộp thành Dict (Logic cũ cho các branch thuần túy).
    """
    if isinstance(node, list):
        # Case 1: Toàn bộ là string (Leaves) -> Giữ nguyên
        if all(isinstance(x, str) for x in node):
            return node
        
        # [FIX] Case 2: Danh sách hỗn hợp (Leaf nằm chung với Branch)
        # Ví dụ: ["ne1", "ne2", {"branch": [...]}]
        # Ta phải giữ nguyên dạng List để bảo toàn các string "ne1", "ne2"
        if any(isinstance(x, str) for x in node):
            return [simplify_structure(item) for item in node]

        # Case 3: Chỉ toàn là Dict (Các Branch con) -> Gộp key lại cho gọn
        # (Giữ logic cũ này để tương thích với các sách Nikaya lớn nếu có cấu trúc này)
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
    # ... (Giữ nguyên hàm này)
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
    # ... (Giữ nguyên hàm này)
    if uid not in target_dict:
        info = meta_map.get(uid, {}) # type: ignore
        target_dict[uid] = {
            "type": info.get("type", type_default),
            "acronym": info.get("acronym", ""),
            "translated_title": info.get("translated_title", ""),
            "original_title": info.get("original_title", ""),
            "blurb": info.get("blurb"),
            "author_uid": None 
        }

def collect_meta_from_structure(node: Any, meta_map: Dict[str, SuttaMeta], target_dict: Dict[str, Any]) -> None:
    # ... (Giữ nguyên hàm này)
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
    # ... (Giữ nguyên hàm này)
    # 1. Structure
    raw_tree = load_original_tree(group_name)
    structure = simplify_structure(raw_tree)

    # 2. Meta Base
    meta_dict: Dict[str, Any] = {}
    collect_meta_from_structure(structure, names_map, meta_dict)
    
    # Bổ sung meta cho các bài kinh lẻ (nếu không nằm trong tree)
    for sid in raw_data.keys():
        if sid not in meta_dict:
            _add_meta_entry(sid, "leaf", names_map, meta_dict)

    # 3. Process Data
    content_dict = {}
    
    for uid, payload in raw_data.items():
        if not payload: continue
        
        # A. Cập nhật Content
        content_dict[uid] = payload.get("data", {}) 
        
        # B. Cập nhật Meta (Inject Author)
        author = payload.get("author_uid")
        if uid in meta_dict and author:
            meta_dict[uid]["author_uid"] = author

    ordered_leaves = flatten_tree_leaves(structure)
    final_content_ordered = {}
    for uid in ordered_leaves:
        if uid in content_dict:
            final_content_ordered[uid] = content_dict[uid]
    
    for uid, content in content_dict.items():
        if uid not in final_content_ordered:
            final_content_ordered[uid] = content

    book_id = group_name.split("/")[-1]
    book_meta = names_map.get(book_id, {}) # type: ignore

    return {
        "id": book_id,
        "title": book_meta.get("translated_title", book_id.upper()),
        "structure": structure,
        "meta": meta_dict,
        "content": final_content_ordered 
    }