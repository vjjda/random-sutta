# Path: src/sutta_processor/optimizer/schema.py
from typing import Dict, Any, List, Optional

def build_meta_entry(
    uid: str, 
    full_meta: Dict[str, Any], 
    nav_map: Dict[str, Any], 
    chunk_idx: Optional[int]
) -> Dict[str, Any]:
    """
    Tạo object metadata chuẩn.
    """
    info = full_meta.get(uid, {})
    m_type = info.get("type", "branch")
    
    # 1. Alias (Pre-calculated in Staging)
    if m_type == "alias":
        # Staging đã tạo sẵn target_uid
        target = info.get("target_uid")
        # Fallback phòng hờ dữ liệu cũ (nhưng về cơ bản là thừa)
        if not target:
             target = info.get("extract_id") or info.get("parent_uid")
             
        return { 
            "type": "alias", 
            "target_uid": target 
        }

    # 2. Standard Entry
    entry = {
        "type": m_type
    }
    
    for key in ["acronym", "translated_title", "original_title", "author_uid", "blurb"]:
        if info.get(key):
            entry[key] = info[key]
    
    if uid in nav_map: 
        entry["nav"] = nav_map[uid]
    
    if chunk_idx is not None: 
        entry["chunk"] = chunk_idx

    if m_type == "subleaf":
        if "extract_id" in info: entry["extract_id"] = info["extract_id"]
        if "parent_uid" in info: entry["parent_uid"] = info["parent_uid"]
        
    return entry

def build_book_payload(
    book_id: str,
    title: str,
    tree: Any,
    meta: Dict[str, Any],
    random_pool: List[str],
    book_type: str = "book",
    root_id: str = None,
    root_title: str = None,
    children: List[str] = None
) -> Dict[str, Any]:
    payload = {
        "id": book_id,
        "type": book_type,
        "title": title,
        "tree": tree,
        "meta": meta,
        "random_pool": random_pool
    }

    if root_id: payload["super_book_id"] = root_id
    if root_title: payload["super_book_title"] = root_title
    if children: payload["children"] = children
        
    return payload