# Path: src/sutta_processor/optimizer/worker/utils.py
from typing import Dict, Optional, Any

def resolve_chunk_idx(uid: str, current_chunk_map: Dict[str, int], full_meta: Dict[str, Any]) -> Optional[int]:
    """Helper: Tìm chunk index cho UID (hỗ trợ cả subleaf/alias)."""
    # 1. Direct Hit
    if uid in current_chunk_map: return current_chunk_map[uid]
    
    # 2. Indirect Hit
    info = full_meta.get(uid, {})
    m_type = info.get("type")
    
    if m_type in ["alias", "subleaf"]:
        parent = info.get("parent_uid")
        if parent and parent in current_chunk_map: return current_chunk_map[parent]
        
        extract = info.get("extract_id")
        if extract and extract in current_chunk_map: return current_chunk_map[extract]
            
    return None