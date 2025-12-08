# Path: src/sutta_processor/logic/structure_handler.py
import json
import logging
from typing import Dict, Any, List

from ..shared.app_config import RAW_BILARA_DIR
from ..shared.domain_types import SuttaMeta
from .range_expander import generate_subleaf_shortcuts

# [NEW] Import các hàm tính toán Nav
from .tree_utils import (
    extract_nav_sequence, 
    generate_navigation_map, 
    generate_random_pool, 
    generate_depth_navigation
)

logger = logging.getLogger("SuttaProcessor.Logic.Structure")

def load_original_tree(group_name: str) -> Dict[str, Any]:
    # ... (Giữ nguyên hàm này) ...
    book_id = group_name.split("/")[-1]
    tree_path = RAW_BILARA_DIR / "tree" / group_name / f"{book_id}-tree.json"
    
    if not tree_path.exists():
        found = list((RAW_BILARA_DIR / "tree").rglob(f"{book_id}-tree.json"))
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
    # ... (Giữ nguyên hàm này) ...
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

def _add_meta_entry(uid: str, type_default: str, meta_map: Dict[str, SuttaMeta], target_dict: Dict[str, Any]) -> None:
    # ... (Giữ nguyên hàm này) ...
    if uid not in target_dict:
        info = meta_map.get(uid, {}) # type: ignore
        entry = {
            "type": info.get("type", type_default),
            "acronym": info.get("acronym", ""),
            "translated_title": info.get("translated_title", ""),
            "original_title": info.get("original_title", ""),
            "blurb": info.get("blurb"),
            "author_uid": None
        }
        
        eid = info.get("extract_id")
        if eid:
            entry["extract_id"] = eid
            
        target_dict[uid] = entry

def expand_structure_with_subleaves(
    node: Any, 
    raw_content_map: Dict[str, Any], 
    meta_map: Dict[str, SuttaMeta], 
    target_meta_dict: Dict[str, Any]
) -> Any:
    # ... (Giữ nguyên hàm này) ...
    if isinstance(node, str):
        uid = node
        if uid in raw_content_map:
            payload = raw_content_map[uid]
            parent_meta = meta_map.get(uid, {})
            parent_acronym = parent_meta.get("acronym", "")
            
            expanded_ids, generated_meta = generate_subleaf_shortcuts(
                root_uid=uid,
                content=payload.get("data", {}),
                parent_acronym=parent_acronym
            )
            
            for sc_id, sc_data in generated_meta.items():
                if sc_id not in target_meta_dict:
                    api_info = meta_map.get(sc_id, {})
                
                    entry = {
                        "type": sc_data["type"],
                        "acronym": sc_data["acronym"],
                        "parent_uid": sc_data["parent_uid"]
                    }
                    
                    if "extract_id" in sc_data:
                        entry["extract_id"] = sc_data["extract_id"]
                    
                    if api_info.get("translated_title"):
                        entry["translated_title"] = api_info["translated_title"]
                    if api_info.get("original_title"):
                        entry["original_title"] = api_info["original_title"]
                    
                    target_meta_dict[sc_id] = entry
            
            if len(expanded_ids) > 1:
                return {uid: expanded_ids}
            else:
                return uid
            
        return uid

    elif isinstance(node, list):
        new_list = []
        for child in node:
            res = expand_structure_with_subleaves(child, raw_content_map, meta_map, target_meta_dict)
            if isinstance(res, list):
                 new_list.extend(res)
            else:
                 new_list.append(res)
        return new_list

    elif isinstance(node, dict):
        new_dict = {}
        for key, val in node.items():
            new_dict[key] = expand_structure_with_subleaves(val, raw_content_map, meta_map, target_meta_dict)
            _add_meta_entry(key, "branch", meta_map, target_meta_dict)
        return new_dict
    
    return node

def build_book_data(
    group_name: str, 
    raw_data: Dict[str, Any], 
    names_map: Dict[str, SuttaMeta]
) -> Dict[str, Any]:
    """
    Xây dựng dữ liệu sách (Staging).
    [UPDATED] Tính toán Nav và Random Pool ngay tại đây.
    """
    raw_tree = load_original_tree(group_name)
    simple_tree = simplify_structure(raw_tree)

    meta_dict: Dict[str, Any] = {}
    
    # 1. Expand Subleaves & Build Base Meta
    final_structure = expand_structure_with_subleaves(simple_tree, raw_data, names_map, meta_dict)
    
    # 2. Add Content Meta
    content_dict = {}
    for uid, payload in raw_data.items():
        if not payload: continue
        content_dict[uid] = payload.get("data", {})
        
        if uid not in meta_dict:
            _add_meta_entry(uid, "leaf", names_map, meta_dict)
            
        author = payload.get("author_uid")
        if uid in meta_dict and author:
            meta_dict[uid]["author_uid"] = author

    # [NEW] 3. Calculate Navigation (Rich Staging)
    # Tính toán cả 2 luồng: Reading Nav (Leaf/Subleaf) và Branch Nav
    
    # A. Reading Nav
    nav_sequence = extract_nav_sequence(final_structure, meta_dict)
    reading_nav_map = generate_navigation_map(nav_sequence)
    random_pool = generate_random_pool(nav_sequence) # Linear List cho random
    
    # B. Branch Nav
    branch_nav_map = generate_depth_navigation(final_structure, meta_dict)
    
    # C. Merge & Inject into Meta
    full_nav_map = {**branch_nav_map, **reading_nav_map}
    
    for uid, nav_entry in full_nav_map.items():
        if uid in meta_dict:
            meta_dict[uid]["nav"] = nav_entry

    book_id = group_name.split("/")[-1]
    book_meta = names_map.get(book_id, {})

    return {
        "id": book_id,
        "title": book_meta.get("translated_title", book_id.upper()),
        "structure": final_structure,
        "meta": meta_dict,
        "content": content_dict,
        "random_pool": random_pool # [NEW] Lưu sẵn pool để worker dùng luôn
    }