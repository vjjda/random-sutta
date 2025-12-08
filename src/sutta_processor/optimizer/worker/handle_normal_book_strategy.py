# Path: src/sutta_processor/optimizer/worker/handle_normal_book_strategy.py
from typing import Dict, Any, List

from ..io_manager import IOManager
from ..chunker import chunk_content
from ..tree_utils import collect_all_keys
from ..schema import build_meta_entry, build_book_payload
from .chunk_index_resolver import resolve_chunk_idx

def execute_normal_book_strategy(
    book_id: str, 
    data: Dict, 
    full_meta: Dict, 
    structure: Any, 
    nav_map: Dict, 
    linear_uids: List[str],
    io: IOManager, 
    result: Dict
) -> None:
    """
    Chiến lược xử lý cho các sách thường (MN, DN...).
    """
    # 1. Content Chunking
    normal_chunk_map = {}
    raw_content = data.get("content", {})
    if raw_content:
        chunks = chunk_content(book_id, raw_content)
        for idx, (fname, chunk_data) in enumerate(chunks):
            io.save_category("content", f"{fname}.json", chunk_data)
            for uid in chunk_data.keys():
                normal_chunk_map[uid] = idx

    # 2. Meta & Locator
    slim_meta_map = {}
    all_keys = set()
    collect_all_keys(structure, all_keys)
    all_keys.add(book_id)
    
    # Quét thêm meta keys để vợt alias (nếu có)
    for k in full_meta.keys(): 
        all_keys.add(k)

    for k in all_keys:
        c_idx = resolve_chunk_idx(k, normal_chunk_map, full_meta)
        result["locator_map"][k] = [book_id, c_idx]
        slim_meta_map[k] = build_meta_entry(k, full_meta, nav_map, c_idx)
    
    # Save Book
    # [UPDATED] Không truyền random_pool
    payload = build_book_payload(
        book_id=book_id,
        title=data.get("title"),
        tree=structure,
        meta=slim_meta_map,
        book_type="book"
    )
    io.save_category("meta", f"{book_id}.json", payload)
    
    result["valid_count"] = len(linear_uids)
    
    # [KEEP] Gửi pool về để ghi vào constants.js
    result["pool_data"] = {
        book_id: linear_uids
    }