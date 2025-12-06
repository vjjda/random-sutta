# Path: src/sutta_processor/optimizer/chunker.py
import json
from typing import Dict, Any, List, Tuple
from .config import CHUNK_SIZE_LIMIT

def chunk_content(safe_name: str, content: Dict[str, Any]) -> List[Tuple[str, Dict[str, Any]]]:
    """
    Trả về danh sách các chunks.
    Format: [(filename_no_ext, chunk_data), ...]
    """
    chunks = []
    chunk_idx = 1
    current_chunk = {}
    current_size = 0
    
    sorted_keys = sorted(content.keys()) 
    
    for uid in sorted_keys:
        item_data = content[uid]
        # Tính size dựa trên string tối ưu
        item_str = json.dumps(item_data, ensure_ascii=False, separators=(',', ':'))
        item_size = len(item_str.encode('utf-8'))
        
        if current_size + item_size > CHUNK_SIZE_LIMIT and current_chunk:
            # Đóng gói chunk cũ
            fname = f"{safe_name}_chunk_{chunk_idx}"
            chunks.append((fname, current_chunk))
            
            chunk_idx += 1
            current_chunk = {}
            current_size = 0
        
        current_chunk[uid] = item_data
        current_size += item_size
        
    # Chunk cuối
    if current_chunk:
        fname = f"{safe_name}_chunk_{chunk_idx}"
        chunks.append((fname, current_chunk))
        
    return chunks