# Path: src/sutta_processor/optimizer/worker/chunk_index_resolver.py
from typing import Dict, Optional, Any

def resolve_chunk_idx(uid: str, current_chunk_map: Dict[str, int], full_meta: Dict[str, Any]) -> Optional[int]:
    """
    Helper chuyên biệt để tìm Chunk Index cho một UID.
    Nó có khả năng 'leo' qua Parent hoặc Extract ID để tìm content thực sự.
    """
    # 1. Direct Hit (UID có nội dung trực tiếp)
    if uid in current_chunk_map: 
        return current_chunk_map[uid]
    
    # 2. Indirect Hit (Subleaf / Alias)
    info = full_meta.get(uid, {})
    m_type = info.get("type")
    
    if m_type in ["alias", "subleaf"]:
        # Ưu tiên Parent (Container File)
        parent = info.get("parent_uid")
        if parent and parent in current_chunk_map: 
            return current_chunk_map[parent]
        
        # Fallback: Extract ID
        extract = info.get("extract_id")
        if extract and extract in current_chunk_map: 
            return current_chunk_map[extract]
            
    return None