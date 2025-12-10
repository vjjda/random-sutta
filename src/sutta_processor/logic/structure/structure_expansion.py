# Path: src/sutta_processor/logic/structure/structure_expansion.py
from typing import Dict, Any, List

from ...shared.domain_types import SuttaMeta
from ..range_expander import generate_subleaf_shortcuts
from .meta_service import ensure_meta_entry

def expand_structure_with_subleaves(
    node: Any, 
    raw_content_map: Dict[str, Any], 
    meta_map: Dict[str, SuttaMeta], 
    target_meta_dict: Dict[str, Any]
) -> Any:
    """
    Duyệt cây, nếu gặp Node có Subleaf (range) thì bung ra và tạo meta cho con/alias.
    """
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
                    
                    if sc_data["type"] == "alias":
                        # [UPDATED] Alias Entry
                        # Chỉ lấy những trường cần thiết cho Alias
                        entry = {
                            "type": "alias",
                            "target_uid": sc_data.get("target_uid"),
                        }
                        if sc_data.get("hash_id"):
                            entry["hash_id"] = sc_data.get("hash_id")
                            
                        target_meta_dict[sc_id] = entry
                    
                    else:
                        # [KEEP] Subleaf Entry (Giữ nguyên logic cũ)
                        api_info = meta_map.get(sc_id, {})
                        entry = {
                            "type": sc_data["type"],
                            "parent_uid": sc_data["parent_uid"]
                        }
                        if sc_data.get("acronym"):
                             entry["acronym"] = sc_data["acronym"]
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
            ensure_meta_entry(key, "branch", meta_map, target_meta_dict)
        return new_dict
    
    return node