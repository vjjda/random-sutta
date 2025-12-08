# Path: src/sutta_processor/optimizer/worker.py
import json
import logging
import traceback
from pathlib import Path
from typing import Dict, Any, List, Set, Optional

from .io_manager import IOManager
from .chunker import chunk_content
from .tree_utils import flatten_tree_uids, collect_all_keys, build_nav_map
from .splitter import is_split_book, extract_sub_books
# [NEW] Import schema builders
from .schema import build_meta_entry, build_book_payload 

logger = logging.getLogger("Optimizer.Worker")

def _resolve_chunk_idx(uid: str, current_chunk_map: Dict[str, int], full_meta: Dict) -> Optional[int]:
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

def _handle_split_mode(
    book_id: str, 
    data: Dict, 
    full_meta: Dict, 
    structure: Any, 
    nav_map: Dict, 
    io: IOManager, 
    result: Dict
):
    """Xử lý sách cần chia nhỏ (AN, SN)."""
    sub_books = extract_sub_books(book_id, structure, full_meta)
    sub_book_ids = []
    root_title = data.get("title", "")
    raw_content = data.get("content", {})
    
    # Super Meta (Menu mẹ)
    super_meta_map = {}
    if book_id in full_meta:
        super_meta_map[book_id] = build_meta_entry(book_id, full_meta, nav_map, None)

    total_valid_count = 0

    for sub_id, all_sub_keys, sub_struct in sub_books:
        # 1. Content Chunking cho Sách Con
        sub_content = {}
        sub_leaves_check = []
        flatten_tree_uids(sub_struct, full_meta, sub_leaves_check)
        
        for uid in sub_leaves_check:
            if uid in raw_content:
                sub_content[uid] = raw_content[uid]
            else:
                # Fix lỗi content thiếu: Lấy từ Parent Container
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

        # 2. Build Meta & Locator
        sub_meta_map = {}
        for k in all_sub_keys:
            c_idx = _resolve_chunk_idx(k, sub_chunk_map, full_meta)
            result["locator_map"][k] = [sub_id, c_idx]
            sub_meta_map[k] = build_meta_entry(k, full_meta, nav_map, c_idx)

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
            random_pool=sub_leaves_check,
            book_type="sub_book",
            root_id=book_id,
            root_title=root_title
        )
        io.save_category("meta", f"{sub_id}.json", sub_payload)
        
        sub_book_ids.append(sub_id)
        count = len(sub_leaves_check)
        result["sub_counts"][sub_id] = count
        total_valid_count += count

    # Save Super-Book
    result["locator_map"][book_id] = [book_id, None]
    super_tree = { book_id: sub_book_ids }
    
    super_payload = build_book_payload(
        book_id=book_id,
        title=root_title,
        tree=super_tree,
        meta=super_meta_map,
        random_pool=[],
        book_type="super_book",
        children=sub_book_ids
    )
    io.save_category("meta", f"{book_id}.json", super_payload)
    
    result["valid_count"] = total_valid_count
    result["sub_books_list"] = sub_book_ids

def _handle_normal_mode(
    book_id: str, 
    data: Dict, 
    full_meta: Dict, 
    structure: Any, 
    nav_map: Dict, 
    linear_uids: List[str],
    io: IOManager, 
    result: Dict
):
    """Xử lý sách thường (MN, DN, ...)."""
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
    for k in full_meta.keys(): all_keys.add(k)

    for k in all_keys:
        c_idx = _resolve_chunk_idx(k, normal_chunk_map, full_meta)
        result["locator_map"][k] = [book_id, c_idx]
        slim_meta_map[k] = build_meta_entry(k, full_meta, nav_map, c_idx)
    
    # Save Book
    payload = build_book_payload(
        book_id=book_id,
        title=data.get("title"),
        tree=structure,
        meta=slim_meta_map,
        random_pool=linear_uids,
        book_type="book"
    )
    io.save_category("meta", f"{book_id}.json", payload)
    
    result["valid_count"] = len(linear_uids)

def process_book_task(file_path: Path, dry_run: bool) -> Dict[str, Any]:
    io = IOManager(dry_run)
    result = { "status": "error", "book_id": "", "valid_count": 0, "locator_map": {}, "sub_counts": {} }

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        book_id = data.get("id", "").lower()
        result["book_id"] = book_id
        
        full_meta = data.get("meta", {})
        structure = data.get("structure", {})
        
        # Shared: Nav Calculation
        linear_uids = []
        flatten_tree_uids(structure, full_meta, linear_uids)
        nav_map = build_nav_map(linear_uids)
        
        if is_split_book(book_id):
            _handle_split_mode(book_id, data, full_meta, structure, nav_map, io, result)
        else:
            _handle_normal_mode(book_id, data, full_meta, structure, nav_map, linear_uids, io, result)

        result["status"] = "success"
        return result

    except Exception as e:
        logger.error(f"❌ Worker failed on {file_path.name}: {e}")
        traceback.print_exc()
        return result