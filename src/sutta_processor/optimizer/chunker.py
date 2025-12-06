# Path: src/sutta_processor/optimizer/chunker.py
import json
from typing import Dict, Any, List, Tuple
from .config import CHUNK_SIZE_LIMIT

def chunk_content_with_meta(
    safe_name: str, 
    content: Dict[str, Any], 
    meta: Dict[str, Any]
) -> List[Tuple[str, Dict[str, Any]]]:
    """
    Cắt content kèm theo meta tương ứng.
    Trả về: [(filename, {uid: {content: ..., meta: ...}}), ...]
    """
    chunks = []
    chunk_idx = 1
    current_chunk = {}
    current_size = 0
    
    # 1. Map Shortcut vào Parent để đảm bảo chúng đi cùng nhau
    # parent_uid -> list[shortcut_meta_object]
    parent_to_shortcuts = {}
    
    # Duyệt meta để tìm shortcut (vì shortcut ko có trong content)
    for uid, info in meta.items():
        if info.get("type") == "shortcut":
            parent = info.get("parent_uid")
            if parent:
                if parent not in parent_to_shortcuts:
                    parent_to_shortcuts[parent] = []
                # Lưu cả uid vào object meta để tiện khi bung ra
                info_with_id = info.copy()
                info_with_id["_uid"] = uid 
                parent_to_shortcuts[parent].append(info_with_id)

    # 2. Duyệt qua các bài kinh chính (Leaves)
    sorted_keys = sorted(content.keys()) 
    
    for uid in sorted_keys:
        # Build Item Data (Gồm Content + Meta + Shortcuts con)
        item_bundle = {}
        
        # A. Chính nó (Leaf)
        item_bundle[uid] = {
            "content": content[uid],
            "meta": meta.get(uid)
        }
        
        # B. Các Shortcut con (nếu có)
        if uid in parent_to_shortcuts:
            for sc_info in parent_to_shortcuts[uid]:
                sc_id = sc_info.pop("_uid") # Lấy ID ra làm key
                item_bundle[sc_id] = {
                    "meta": sc_info
                    # Shortcut không có content
                }

        # Tính size của cả cụm này
        item_str = json.dumps(item_bundle, ensure_ascii=False, separators=(',', ':'))
        item_size = len(item_str.encode('utf-8'))
        
        # Check size limit
        if current_size + item_size > CHUNK_SIZE_LIMIT and current_chunk:
            fname = f"{safe_name}_chunk_{chunk_idx}"
            chunks.append((fname, current_chunk))
            
            chunk_idx += 1
            current_chunk = {}
            current_size = 0
        
        # Merge item_bundle vào current_chunk
        current_chunk.update(item_bundle)
        current_size += item_size
        
    # Chunk cuối
    if current_chunk:
        fname = f"{safe_name}_chunk_{chunk_idx}"
        chunks.append((fname, current_chunk))
        
    return chunks