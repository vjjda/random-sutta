# Path: src/sutta_processor/optimizer/chunker.py
import json
import logging
from typing import Dict, Any, List, Tuple
from .config import CHUNK_SIZE_LIMIT

logger = logging.getLogger("Optimizer.Chunker")

def chunk_content(
    safe_name: str, 
    content: Dict[str, Any]
) -> List[Tuple[str, Dict[str, Any]]]:
    """
    Chia nhỏ content thành các file chunks.
    [UPDATED] Flatten structure: Loại bỏ key wrapper "content".
    Output Format: { "uid": { "segment_id": { "pli": ..., "eng": ... } } }
    """
    chunks = []
    chunk_idx = 0
    current_chunk = {}
    current_size = 0
    
    # Sort keys để đảm bảo thứ tự nhất quán
    sorted_keys = sorted(content.keys()) 
    
    for uid in sorted_keys:
        # [CHANGED] Lấy trực tiếp dict segments, không bọc trong "content"
        item_data = content[uid]
        
        # Tính kích thước ước lượng (giả lập cấu trúc json cuối cùng của item này)
        # Bao gồm cả key uid để tính toán chính xác
        item_str = json.dumps({uid: item_data}, ensure_ascii=False)
        item_size = len(item_str.encode('utf-8'))
        
        # Nếu vượt quá giới hạn -> Cắt chunk mới
        if current_size + item_size > CHUNK_SIZE_LIMIT and current_chunk:
            fname = f"{safe_name}_chunk_{chunk_idx}"
            chunks.append((fname, current_chunk))
            chunk_idx += 1
            current_chunk = {}
            current_size = 0
        
        current_chunk[uid] = item_data
        current_size += item_size
        
    # Đẩy chunk cuối cùng
    if current_chunk:
        fname = f"{safe_name}_chunk_{chunk_idx}"
        chunks.append((fname, current_chunk))
        
    return chunks