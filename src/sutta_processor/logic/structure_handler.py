# Path: src/sutta_processor/logic/structure_handler.py
import json
import logging
from typing import Dict, Any, List

from ..shared.app_config import DATA_ROOT
from ..shared.domain_types import SuttaMeta
from .range_expander import generate_range_shortcuts # [NEW] Import

logger = logging.getLogger("SuttaProcessor.Logic.Structure")

def load_original_tree(group_name: str) -> Dict[str, Any]:
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
    if isinstance(node, list):
        if all(isinstance(x, str) for x in node):
            return node
        
        if any(isinstance(x, str) for x in node):
            return [simplify_structure(item) for item in node]

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
            "blurb": info.get("blurb"),
            "author_uid": None,
            "scroll_target": info.get("scroll_target")
        }

def collect_meta_from_structure(node: Any, meta_map: Dict[str, SuttaMeta], target_dict: Dict[str, Any]) -> None:
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
    
    # 1. Structure (Giữ nguyên)
    raw_tree = load_original_tree(group_name)
    structure = simplify_structure(raw_tree)

    # 2. Meta Base (Giữ nguyên)
    meta_dict: Dict[str, Any] = {}
    collect_meta_from_structure(structure, names_map, meta_dict)
    
    for sid in raw_data.keys():
        if sid not in meta_dict:
            _add_meta_entry(sid, "leaf", names_map, meta_dict)

    # 3. Process Data (Giữ nguyên)
    content_dict = {}
    for uid, payload in raw_data.items():
        if not payload: continue
        content_dict[uid] = payload.get("data", {}) 
        author = payload.get("author_uid")
        if uid in meta_dict and author:
            meta_dict[uid]["author_uid"] = author

    # --- [UPDATED] 4. RANGE EXPANSION ---
    generated_shortcuts = {}
    for uid, segments in content_dict.items():
        # Lấy Acronym của cha từ meta_dict
        parent_acronym = ""
        if uid in meta_dict:
            parent_acronym = meta_dict[uid].get("acronym", "")

        # Truyền parent_acronym vào hàm expander
        shortcuts = generate_range_shortcuts(uid, segments, parent_acronym)
        
        if shortcuts:
            generated_shortcuts.update(shortcuts)
            
    if generated_shortcuts:
        meta_dict.update(generated_shortcuts)
    # -------------------------------------------------------

    # 5. Ordering & Finalize (Giữ nguyên)
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