# Path: src/sutta_processor/logic/structure_handler.py
import json
import logging
from typing import Dict, Any, List

from ..shared.app_config import RAW_BILARA_DIR
from ..shared.domain_types import SuttaMeta
from .range_expander import generate_subleaf_shortcuts

logger = logging.getLogger("SuttaProcessor.Logic.Structure")

def load_original_tree(group_name: str) -> Dict[str, Any]:
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
    if uid not in target_dict:
        info = meta_map.get(uid, {}) # type: ignore
        target_dict[uid] = {
            "type": info.get("type", type_default),
            "acronym": info.get("acronym", ""),
            "translated_title": info.get("translated_title", ""),
            "original_title": info.get("original_title", ""),
            "blurb": info.get("blurb"),
            "author_uid": None,
            "extract_id": info.get("extract_id") # Updated field
        }

def expand_structure_with_subleaves(
    node: Any, 
    raw_content_map: Dict[str, Any], 
    meta_map: Dict[str, SuttaMeta], 
    target_meta_dict: Dict[str, Any]
) -> Any:
    """
    Đệ quy biến đổi Structure:
    - String Node (Range) -> Object Node {parent: [subleaves]}
    """
    if isinstance(node, str):
        uid = node
        # Nếu node này có nội dung (là Leaf/Range)
        if uid in raw_content_map:
            payload = raw_content_map[uid]
            parent_meta = meta_map.get(uid, {})
            parent_acronym = parent_meta.get("acronym", "")
            
            # 1. Gọi Expander
            expanded_ids, generated_meta = generate_subleaf_shortcuts(
                root_uid=uid,
                content=payload.get("data", {}),
                parent_acronym=parent_acronym
            )
            
            # 2. Cập nhật Meta mới sinh ra (Subleaf/Alias)
            for sc_id, sc_data in generated_meta.items():
                if sc_id not in target_meta_dict:
                    api_info = meta_map.get(sc_id, {})
                    entry = {
                        "type": sc_data["type"], # 'subleaf' or 'alias'
                        "acronym": sc_data["acronym"],
                        "parent_uid": sc_data["parent_uid"],
                        "extract_id": sc_data["extract_id"] # Quan trọng: ID để filter content
                    }
                    if api_info.get("translated_title"):
                        entry["translated_title"] = api_info["translated_title"]
                    if api_info.get("original_title"):
                        entry["original_title"] = api_info["original_title"]
                    
                    target_meta_dict[sc_id] = entry
            
            # 3. Transform Structure
            # Nếu expanded_ids > 1 (có subleaves) -> Trả về Object lồng nhau
            if len(expanded_ids) > 1:
                # Nếu ID đầu tiên khác root_uid, ta coi root_uid là container
                return {uid: expanded_ids}
            else:
                # Không expand được (hoặc chỉ có 1 con chính là nó) -> Giữ nguyên string
                return uid
            
        return uid

    elif isinstance(node, list):
        new_list = []
        for child in node:
            res = expand_structure_with_subleaves(child, raw_content_map, meta_map, target_meta_dict)
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
    raw_tree = load_original_tree(group_name)
    simple_tree = simplify_structure(raw_tree)

    meta_dict: Dict[str, Any] = {}
    
    # 1. Recursive Expand
    final_structure = expand_structure_with_subleaves(simple_tree, raw_data, names_map, meta_dict)
    
    # 2. Add missing parent meta (những Parent Leaf bị biến thành Key của Object vẫn cần meta)
    content_dict = {}
    for uid, payload in raw_data.items():
        if not payload: continue
        content_dict[uid] = payload.get("data", {})
        
        if uid not in meta_dict:
            _add_meta_entry(uid, "leaf", names_map, meta_dict)
            
        author = payload.get("author_uid")
        if uid in meta_dict and author:
            meta_dict[uid]["author_uid"] = author

    book_id = group_name.split("/")[-1]
    book_meta = names_map.get(book_id, {})

    return {
        "id": book_id,
        "title": book_meta.get("translated_title", book_id.upper()),
        "structure": final_structure,
        "meta": meta_dict,
        "content": content_dict # Content giữ nguyên theo Parent Key
    }