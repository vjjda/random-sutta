# Path: src/sutta_processor/optimizer/chunker.py
import json
import logging
from typing import Dict, Any, List, Tuple
from .config import CHUNK_SIZE_LIMIT

logger = logging.getLogger("Optimizer.Chunker")

# Ngưỡng dung sai: 20%
# Nếu chunk cuối cùng < 20% của Limit (vd: < 100KB), sẽ gộp vào chunk trước đó.
# Điều này có nghĩa chunk áp chót có thể phình lên tối đa 120% (600KB).
MERGE_THRESHOLD_RATIO = 0.2 
MIN_TAIL_SIZE = CHUNK_SIZE_LIMIT * MERGE_THRESHOLD_RATIO

def chunk_content(
    safe_name: str, 
    content: Dict[str, Any]
) -> List[Tuple[str, Dict[str, Any]]]:
    """
    Chia nhỏ content thành các file chunks.
    [UPDATED] Merge Tiny Tail: Gộp chunk cuối nếu quá nhỏ.
    """
    chunks = []
    chunk_idx = 0
    current_chunk = {}
    current_size = 0
    
    sorted_keys = sorted(content.keys()) 
    
    # 1. Standard Chunking Loop
    for uid in sorted_keys:
        item_data = content[uid]
        
        # Ước lượng size
        item_str = json.dumps({uid: item_data}, ensure_ascii=False)
        item_size = len(item_str.encode('utf-8'))
        
        # Check Limit
        if current_size + item_size > CHUNK_SIZE_LIMIT and current_chunk:
            fname = f"{safe_name}_chunk_{chunk_idx}"
            chunks.append((fname, current_chunk))
            chunk_idx += 1
            current_chunk = {}
            current_size = 0
        
        current_chunk[uid] = item_data
        current_size += item_size
        
    # Push chunk cuối cùng (nếu có)
    if current_chunk:
        fname = f"{safe_name}_chunk_{chunk_idx}"
        chunks.append((fname, current_chunk))
        
    # 2. Optimization: Merge Tiny Tail
    # Chỉ merge nếu có ít nhất 2 chunks
    if len(chunks) >= 2:
        last_name, last_data = chunks[-1]
        
        # Tính kích thước thực của chunk cuối
        last_json = json.dumps(last_data, ensure_ascii=False)
        last_bytes = len(last_json.encode('utf-8'))
        
        if last_bytes < MIN_TAIL_SIZE:
            # Lấy chunk áp chót
            prev_name, prev_data = chunks[-2]
            
            # Gộp data
            prev_data.update(last_data)
            
            # Xóa chunk cuối khỏi danh sách
            chunks.pop()
            
            logger.debug(f"   🤏 Merged tiny tail {last_name} ({last_bytes/1024:.1f}KB) into {prev_name}")

    return chunks