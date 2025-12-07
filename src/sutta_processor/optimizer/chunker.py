# Path: src/sutta_processor/optimizer/chunker.py
import json
import logging
from typing import Dict, Any, List, Tuple
from .config import CHUNK_SIZE_LIMIT

logger = logging.getLogger("Optimizer.Chunker")

def chunk_content_with_meta(
    safe_name: str, 
    content: Dict[str, Any], 
    meta: Dict[str, Any]
) -> List[Tuple[str, Dict[str, Any]]]:
    """
    Cắt content kèm theo meta.
    Gom 'subleaf' vào chunk của 'parent_uid' để Frontend có đủ meta khi load file cha.
    """
    chunks = []
    chunk_idx = 1
    current_chunk = {}
    current_size = 0
    
    # 1. Map Parent -> List[Subleaf/Alias Meta]
    parent_map = {}
    
    for uid, info in meta.items():
        m_type = info.get("type")
        # Gom cả subleaf và alias vào chunk cha
        if m_type in ["subleaf", "alias"]: 
            parent = info.get("parent_uid")
            if parent:
                if parent not in parent_map:
                    parent_map[parent] = []
                
                # Copy info và thêm key _uid để bung ra sau
                info_with_id = info.copy()
                info_with_id["_uid"] = uid 
                parent_map[parent].append(info_with_id)

    # 2. Duyệt qua các bài kinh chính (Parent Leaves)
    sorted_keys = sorted(content.keys()) 
    
    for uid in sorted_keys:
        item_bundle = {}
        
        # A. Parent Leaf
        item_bundle[uid] = {
            "content": content[uid],
            "meta": meta.get(uid)
        }
        
        # B. Children (Subleaves/Aliases)
        if uid in parent_map:
            for child_info in parent_map[uid]:
                child_id = child_info.pop("_uid")
                item_bundle[child_id] = {
                    "meta": child_info
                    # Không có content, FE sẽ tự extract từ cha
                }

        # Size check & Chunking
        item_str = json.dumps(item_bundle, ensure_ascii=False, separators=(',', ':'))
        item_size = len(item_str.encode('utf-8'))
        
        if current_size + item_size > CHUNK_SIZE_LIMIT and current_chunk:
            fname = f"{safe_name}_chunk_{chunk_idx}"
            chunks.append((fname, current_chunk))
            chunk_idx += 1
            current_chunk = {}
            current_size = 0
        
        current_chunk.update(item_bundle)
        current_size += item_size
        
    if current_chunk:
        fname = f"{safe_name}_chunk_{chunk_idx}"
        chunks.append((fname, current_chunk))
        
    return chunks