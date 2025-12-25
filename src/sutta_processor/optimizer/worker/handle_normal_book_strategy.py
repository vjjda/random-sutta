# Path: src/sutta_processor/optimizer/worker/handle_normal_book_strategy.py
from typing import Dict, Any, List, Optional

from ..io_manager import IOManager
from ..chunker import chunk_content
from ..tree_utils import collect_all_keys
from ..schema import build_meta_entry, build_book_payload
from .chunk_index_resolver import resolve_chunk_idx

def _inject_neighbors_from_global(
    current_meta_map: Dict[str, Any],
    nav_map: Dict[str, Any],
    global_meta: Optional[Dict[str, Any]]
) -> None:
    """
    [NEW] Quét tất cả item hiện có, nếu nav trỏ đến UID chưa có trong map,
    thử lấy từ global_meta.
    """
    if not global_meta: return

    # Copy keys để tránh lỗi runtime khi dictionary size thay đổi
    existing_keys = list(current_meta_map.keys())
    
    for uid in existing_keys:
        if uid not in nav_map: continue
        
        nav = nav_map[uid]
        neighbors = []
        if "prev" in nav: neighbors.append(nav["prev"])
        if "next" in nav: neighbors.append(nav["next"])
        
        for neighbor_uid in neighbors:
            # Nếu hàng xóm chưa có trong map (tức là nằm ở sách khác)
            if neighbor_uid not in current_meta_map:
                if neighbor_uid in global_meta:
                    # Inject meta tối giản từ Global Context
                    # (Chunk index là None vì nó nằm ở sách khác)
                    current_meta_map[neighbor_uid] = build_meta_entry(
                        neighbor_uid, global_meta, nav_map, None
                    )

def execute_normal_book_strategy(
    book_id: str, 
    data: Dict, 
    full_meta: Dict, 
    structure: Any, 
    nav_map: Dict, 
    linear_uids: List[str],
    io: IOManager, 
    result: Dict,
    global_meta: Optional[Dict[str, Any]] = None
) -> None:
    """
    Chiến lược xử lý cho các sách thường (MN, DN...).
    [UPDATED] Simplified Boundary Logic.
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

    # 2. Meta & Locator (Internal)
    slim_meta_map = {}
    all_keys = set()
    collect_all_keys(structure, all_keys)
    all_keys.add(book_id)
    
    # Add extra keys present in full_meta (aliases, etc)
    for k in full_meta.keys(): 
        all_keys.add(k)

    keys_list = list(all_keys)

    for k in keys_list:
        c_idx = resolve_chunk_idx(k, normal_chunk_map, full_meta)
        result["locator_map"][k] = [book_id, c_idx]
        slim_meta_map[k] = build_meta_entry(k, full_meta, nav_map, c_idx)

    # 3. [SIMPLIFIED] Universal Neighbor Injection
    # Không cần xử lý riêng cho Book Root nữa, vòng lặp này sẽ tự động 
    # thấy Root trỏ ra ngoài và fetch neighbor.
    _inject_neighbors_from_global(slim_meta_map, nav_map, global_meta)

    # Save Book
    payload = build_book_payload(
        book_id=book_id,
        title=data.get("title"),
        tree=structure,
        meta=slim_meta_map,
        book_type="book"
    )
    io.save_category("meta", f"{book_id}.json", payload)
    
    result["valid_count"] = len(linear_uids)
    result["pool_data"] = { book_id: linear_uids }