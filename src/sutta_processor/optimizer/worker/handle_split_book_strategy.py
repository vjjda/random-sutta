# Path: src/sutta_processor/optimizer/worker/handle_split_book_strategy.py
from typing import Dict, Any, Set, Optional, List

from ..io_manager import IOManager
from ..chunker import chunk_content
from ..tree_utils import flatten_tree_uids
from ..splitter import extract_sub_books
from ..schema import build_meta_entry, build_book_payload
from .chunk_index_resolver import resolve_chunk_idx

def _inject_neighbors_generic(
    current_meta_map: Dict[str, Any],
    nav_map: Dict[str, Any],
    global_meta: Optional[Dict[str, Any]],
    full_meta: Dict[str, Any]
) -> None:
    """
    [UPDATED] Cơ chế inject biên thông minh (Boundary Injection).
    Tìm kiếm hàng xóm còn thiếu từ 2 nguồn:
    1. Global Meta (Cho link ra sách khác: an -> sn)
    2. Full Meta (Cho link nội bộ giữa các sub-books: an1 -> an2)
    """
    # Snapshot các keys hiện tại để loop an toàn
    existing_keys = list(current_meta_map.keys())
    
    for uid in existing_keys:
        if uid not in nav_map: continue
        
        nav = nav_map[uid]
        neighbors = []
        if "prev" in nav: neighbors.append(nav["prev"])
        if "next" in nav: neighbors.append(nav["next"])
        
        for neighbor_uid in neighbors:
            # Nếu hàng xóm đã có mặt, bỏ qua
            if neighbor_uid in current_meta_map:
                continue

            # Chiến lược tìm kiếm nguồn dữ liệu cho hàng xóm
            source_meta = None
            
            # Ưu tiên 1: Tìm trong Global (Sách khác)
            if global_meta and neighbor_uid in global_meta:
                source_meta = global_meta
            
            # Ưu tiên 2: Tìm trong Full Meta của sách hiện tại (Sub-book khác)
            # (Ví dụ: Đang ở an1, cần tìm an2 hoặc leaf của an2)
            elif neighbor_uid in full_meta:
                source_meta = full_meta

            # Nếu tìm thấy nguồn, tạo meta entry và inject vào map hiện tại
            if source_meta:
                # Lưu ý: chunk_idx là None vì hàng xóm này không nằm trong file vật lý hiện tại
                current_meta_map[neighbor_uid] = build_meta_entry(
                    neighbor_uid, source_meta, nav_map, None
                )

def execute_split_book_strategy(
    book_id: str, 
    data: Dict, 
    full_meta: Dict, 
    structure: Any, 
    nav_map: Dict, 
    io: IOManager, 
    result: Dict,
    global_meta: Optional[Dict[str, Any]] = None
) -> None:
    """
    Chiến lược xử lý cho các sách Super Book (AN, SN).
    [UPDATED] Covers all boundary chains (leaves, branches, sub-book roots).
    """
    sub_books = extract_sub_books(book_id, structure, full_meta)
    sub_book_ids = []
    root_title = data.get("title", "")
    raw_content = data.get("content", {})
    
    # Super Meta (Menu mẹ - an.json)
    super_meta_map = {}
    if book_id in full_meta:
        super_meta_map[book_id] = build_meta_entry(book_id, full_meta, nav_map, None)

    total_valid_count = 0
    collected_pools = {}

    for sub_id, all_sub_keys, sub_struct in sub_books:
        # 1. Content Chunking
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

        # 2. Build Meta (Internal items)
        sub_meta_map = {}
        for k in all_sub_keys:
            c_idx = resolve_chunk_idx(k, sub_chunk_map, full_meta)
            result["locator_map"][k] = [sub_id, c_idx]
            sub_meta_map[k] = build_meta_entry(k, full_meta, nav_map, c_idx)

        # [CRITICAL STEP 1] Ensure Sub-book Root is present
        # Đưa 'an1' vào map để nó có thể được quét biên ở bước sau
        if sub_id in full_meta:
            sub_meta_map[sub_id] = build_meta_entry(sub_id, full_meta, nav_map, None)
        elif global_meta and sub_id in global_meta:
            sub_meta_map[sub_id] = build_meta_entry(sub_id, global_meta, nav_map, None)

        # [CRITICAL STEP 2] Universal Boundary Injection
        # Quét toàn bộ sub_meta_map (bao gồm leaves, branches và root 'an1').
        # Tự động tìm hàng xóm từ Global hoặc Full Meta.
        _inject_neighbors_generic(sub_meta_map, nav_map, global_meta, full_meta)

        # Inject Parent Info (cho Sub-book context)
        if book_id in full_meta:
            sub_meta_map[book_id] = build_meta_entry(book_id, full_meta, nav_map, None)
        
        # Collect info cho Super Meta (an.json)
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

    # --- Process Super Book Meta (an.json) ---
    # Cũng áp dụng quét biên cho file mẹ (để biết next/prev sang sách khác như SN)
    _inject_neighbors_generic(super_meta_map, nav_map, global_meta, full_meta)

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