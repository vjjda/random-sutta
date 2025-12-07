# Path: src/sutta_processor/logic/structure_handler.py
import json
import logging
from typing import Dict, Any, List

from ..shared.app_config import RAW_BILARA_DIR
from ..shared.domain_types import SuttaMeta
from .range_expander import generate_subleaf_shortcuts

logger = logging.getLogger("SuttaProcessor.Logic.Structure")

def load_original_tree(group_name: str) -> Dict[str, Any]:
    # ... (Giữ nguyên logic load file) ...
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
    # ... (Giữ nguyên logic simplify) ...
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
        entry = {
            "type": info.get("type", type_default),
            "acronym": info.get("acronym", ""),
            "translated_title": info.get("translated_title", ""),
            "original_title": info.get("original_title", ""),
            "blurb": info.get("blurb"),
            "author_uid": None
        }
        
        # [UPDATED] Chỉ thêm extract_id nếu có
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
                    
                    # [UPDATED] Chỉ thêm extract_id nếu có (cho subleaf)
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