# Path: src/sutta_processor/optimizer/worker/chunk_index_resolver.py
from typing import Dict, Optional, Any

def resolve_chunk_idx(uid: str, current_chunk_map: Dict[str, int], full_meta: Dict[str, Any]) -> Optional[int]:
    """
    Helper tìm Chunk Index.
    """
    # 1. Direct Hit
    if uid in current_chunk_map: return current_chunk_map[uid]
    
    info = full_meta.get(uid, {})
    m_type = info.get("type")
    
    # 2. Alias: Dùng target_uid
    if m_type == "alias":
        target = info.get("target_uid")
        if target and target in current_chunk_map:
            return current_chunk_map[target]
            
    # 3. Subleaf: Dùng parent_uid hoặc extract_id
    if m_type == "subleaf":
        parent = info.get("parent_uid")
        if parent and parent in current_chunk_map: return current_chunk_map[parent]
        
        extract = info.get("extract_id")
        if extract and extract in current_chunk_map: return current_chunk_map[extract]
            
    return None