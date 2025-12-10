# Path: src/sutta_processor/optimizer/schema.py
from typing import Dict, Any, List, Optional

def build_meta_entry(
    uid: str, 
    full_meta: Dict[str, Any], 
    nav_map: Dict[str, Any], 
    chunk_idx: Optional[int]
) -> Dict[str, Any]:
    """
    Tạo object metadata cho một item (Leaf/Subleaf/Alias/Branch).
    """
    info = full_meta.get(uid, {})
    m_type = info.get("type", "branch")
    
    # 1. Alias (Slim)
    if m_type == "alias":
        # [UPDATED] Lấy target_uid và hash_id theo chuẩn mới
        target = info.get("target_uid")
        
        # Fallback cũ (đề phòng dữ liệu staging cũ chưa clean)
        if not target:
            target = info.get("extract_id") or info.get("parent_uid")
            
        entry = { 
            "type": "alias", 
            "target_uid": target 
        }
        
        if info.get("hash_id"):
            entry["hash_id"] = info["hash_id"]
            
        return entry

    # 2. Standard Entry
    entry = {
        "type": m_type
    }
    
    # Copy optional fields only if exist
    for key in ["acronym", "translated_title", "original_title", "author_uid", "blurb"]:
        if info.get(key):
            entry[key] = info[key]
    
    # Navigation
    if uid in nav_map: 
        entry["nav"] = nav_map[uid]
    
    # Chunk Index (Content Location)
    if chunk_idx is not None: 
        entry["chunk"] = chunk_idx

    # Subleaf specifics
    if m_type == "subleaf":
        if "extract_id" in info: entry["extract_id"] = info["extract_id"]
        if "parent_uid" in info: entry["parent_uid"] = info["parent_uid"]
        
    return entry

def build_book_payload(
    book_id: str,
    title: str,
    tree: Any,
    meta: Dict[str, Any],
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
        "meta": meta
    }

    if root_id: 
        payload["super_book_id"] = root_id
    if root_title: 
        payload["super_book_title"] = root_title
    if children: 
        payload["children"] = children
        
    return payload