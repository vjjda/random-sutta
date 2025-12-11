# Path: src/sutta_processor/optimizer/worker/handle_split_book_strategy.py
from typing import Dict, Any, Set

from ..io_manager import IOManager
from ..chunker import chunk_content
from ..tree_utils import flatten_tree_uids, collect_all_keys
from ..splitter import extract_sub_books
from ..schema import build_meta_entry, build_book_payload
from .chunk_index_resolver import resolve_chunk_idx

def execute_split_book_strategy(
    book_id: str, 
    data: Dict, 
    full_meta: Dict, 
    structure: Any, 
    nav_map: Dict, 
    io: IOManager, 
    result: Dict
) -> None:
    """
    Chiến lược xử lý cho các sách Super Book (AN, SN).
    [UPDATED] Inject Meta của Next/Prev biên (Boundary Neighbors) để đảm bảo nút điều hướng luôn có info.
    """
    sub_books = extract_sub_books(book_id, structure, full_meta)
    sub_book_ids = []
    root_title = data.get("title", "")
    raw_content = data.get("content", {})
    
    # Super Meta (Menu mẹ)
    super_meta_map = {}
    if book_id in full_meta:
        super_meta_map[book_id] = build_meta_entry(book_id, full_meta, nav_map, None)

    total_valid_count = 0
    collected_pools = {}

    for sub_id, all_sub_keys, sub_struct in sub_books:
        # 1. Content Chunking cho Sách Con
        sub_content = {}
        sub_leaves_check = []
        flatten_tree_uids(sub_struct, full_meta, sub_leaves_check)
        
        for uid in sub_leaves_check:
            if uid in raw_content:
                 sub_content[uid] = raw_content[uid]
            else:
                parent = full_meta.get(uid, {}).get("parent_uid")
                if parent and parent in raw_content:
                    sub_content[parent] = raw_content[parent]
        
        sub_chunk_map = {}
        if sub_content:
            chunks = chunk_content(sub_id, sub_content)
            for idx, (fname, chunk_data) in enumerate(chunks):
                io.save_category("content", f"{fname}.json", chunk_data)
                for uid in chunk_data.keys():
                    sub_chunk_map[uid] = idx

        # 2. Build Meta & Locator (Core Items)
        sub_meta_map = {}
        for k in all_sub_keys:
            c_idx = resolve_chunk_idx(k, sub_chunk_map, full_meta)
            result["locator_map"][k] = [sub_id, c_idx]
            sub_meta_map[k] = build_meta_entry(k, full_meta, nav_map, c_idx)

        # 3. [NEW] Boundary Injection (Tiêm Meta của hàng xóm)
        # Tìm First và Last Leaf để xác định hàng xóm biên
        if sub_leaves_check:
            first_uid = sub_leaves_check[0]
            last_uid = sub_leaves_check[-1]
            
            # Xác định Prev của bài đầu và Next của bài cuối
            prev_boundary = nav_map.get(first_uid, {}).get("prev")
            next_boundary = nav_map.get(last_uid, {}).get("next")
            
            boundary_neighbors = []
            if prev_boundary: boundary_neighbors.append(prev_boundary)
            if next_boundary: boundary_neighbors.append(next_boundary)
            
            for neighbor_uid in boundary_neighbors:
                # Chỉ tiêm nếu nó CHƯA có trong sub_meta_map (tức là nó thuộc sách khác)
                if neighbor_uid not in sub_meta_map:
                    # chunk_idx sẽ là None vì nó không nằm trong content file của sách này
                    # Nhưng meta title/acronym sẽ có đủ để hiển thị nút
                    sub_meta_map[neighbor_uid] = build_meta_entry(neighbor_uid, full_meta, nav_map, None)

        # Inject Parent Info vào con
        if book_id in full_meta:
            sub_meta_map[book_id] = build_meta_entry(book_id, full_meta, nav_map, None)
        
        # Collect info cho Mẹ
        if sub_id in full_meta:
            super_meta_map[sub_id] = build_meta_entry(sub_id, full_meta, nav_map, None)
        else:
            super_meta_map[sub_id] = { "acronym": sub_id.upper(), "type": "branch" }

        # Save Sub-Book
        final_tree = { book_id: { sub_id: sub_struct } }
        
        sub_payload = build_book_payload(
            book_id=sub_id,
            title=f"{sub_id.upper()}",
            tree=final_tree,
            meta=sub_meta_map,
            book_type="sub_book",
            root_id=book_id,
            root_title=root_title
        )
        io.save_category("meta", f"{sub_id}.json", sub_payload)
        
        sub_book_ids.append(sub_id)
        count = len(sub_leaves_check)
        result["sub_counts"][sub_id] = count
        total_valid_count += count
        collected_pools[sub_id] = sub_leaves_check

    # Save Super-Book
    result["locator_map"][book_id] = [book_id, None]
    super_tree = { book_id: sub_book_ids }
    
    super_payload = build_book_payload(
        book_id=book_id,
        title=root_title,
        tree=super_tree,
        meta=super_meta_map,
        book_type="super_book",
        children=sub_book_ids
    )
    io.save_category("meta", f"{book_id}.json", super_payload)
    
    result["valid_count"] = total_valid_count
    result["sub_books_list"] = sub_book_ids
    result["pool_data"] = collected_pools