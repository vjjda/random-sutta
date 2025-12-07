# Path: src/sutta_processor/optimizer/worker.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Set

from .io_manager import IOManager
from .chunker import chunk_content_with_meta
from .tree_utils import flatten_tree_uids, collect_all_keys, build_nav_map
from .splitter import is_split_book, extract_sub_books

logger = logging.getLogger("Optimizer.Worker")

def _build_meta_entry(uid: str, full_meta: Dict, nav_map: Dict, chunk_map: Dict) -> Dict[str, Any]:
    # ... (Giữ nguyên hàm này không đổi) ...
    info = full_meta.get(uid, {})
    m_type = info.get("type", "branch")
    
    entry = {}
    if info.get("acronym"): entry["acronym"] = info["acronym"]
    if info.get("translated_title"): entry["translated_title"] = info["translated_title"]
    if info.get("original_title"): entry["original_title"] = info["original_title"]
    if info.get("author_uid"): entry["author_uid"] = info["author_uid"]
    if info.get("blurb"): entry["blurb"] = info["blurb"]
    
    entry["type"] = m_type
    if uid in nav_map: entry["nav"] = nav_map[uid]
    if uid in chunk_map: entry["chunk"] = chunk_map[uid]

    if m_type == "subleaf":
        if "extract_id" in info: entry["extract_id"] = info["extract_id"]
        if "parent_uid" in info: entry["parent_uid"] = info["parent_uid"]
    return entry

def process_book_task(file_path: Path, dry_run: bool) -> Dict[str, Any]:
    io = IOManager(dry_run)
    # result trả về locator_map để index, và valid_count cho thống kê
    # Nhưng với split book, valid_count của sách mẹ sẽ là 0 để không export ra constants
    result = { "status": "error", "book_id": "", "valid_count": 0, "locator_map": {}, "sub_counts": {} }

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        book_id = data.get("id", "").lower()
        result["book_id"] = book_id
        
        full_meta = data.get("meta", {})
        structure = data.get("structure", {})
        
        # 1. Nav & Random Pool
        linear_uids = []
        flatten_tree_uids(structure, full_meta, linear_uids)
        nav_map = build_nav_map(linear_uids)
        
        # 2. Content Chunking
        chunk_map_idx = {}
        raw_content = data.get("content", {})
        if raw_content:
            chunks = chunk_content_with_meta(book_id, raw_content, full_meta)
            for idx, (fname, chunk_data) in enumerate(chunks):
                io.save_category("content", f"{fname}.json", chunk_data)
                for uid in chunk_data.keys():
                    chunk_map_idx[uid] = idx

        # 3. Metadata Processing
        if is_split_book(book_id):
            # --- SPLIT MODE (AN, SN) ---
            sub_books = extract_sub_books(book_id, structure, full_meta)
            sub_book_ids = []
            
            # Parent Title (Dùng để nhúng vào con)
            root_title = data.get("title", "")

            for sub_id, sub_leaves, sub_struct in sub_books:
                sub_meta_map = {}
                
                # A. Locator & Meta
                all_sub_keys: Set[str] = set()
                collect_all_keys(sub_struct, all_sub_keys)
                all_sub_keys.add(sub_id)
                
                for k in all_sub_keys:
                    result["locator_map"][k] = sub_id
                    sub_meta_map[k] = _build_meta_entry(k, full_meta, nav_map, chunk_map_idx)

                # B. Save Sub-Book
                io.save_category("meta", f"{sub_id}.json", {
                    "id": sub_id,
                    "title": f"{sub_id.upper()}", # Title con (ví dụ: AN 1)
                    "root_id": book_id,           # [NEW] Link ngược về AN
                    "root_title": root_title,     # [NEW] Title của AN
                    "tree": {sub_id: sub_struct}, 
                    "meta": sub_meta_map,
                    "random_pool": sub_leaves
                })
                
                sub_book_ids.append(sub_id)
                
                # [NEW] Trả về count của sub-book để PoolManager ghi vào SUTTA_COUNTS
                result["sub_counts"][sub_id] = len(sub_leaves)

            # Save Super-Book (Chỉ để duyệt mục lục, không dùng Random)
            result["locator_map"][book_id] = book_id
            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "type": "super_group",
                "title": root_title,
                "children": sub_book_ids
            })
            
            # valid_count = 0 để sách mẹ (an) KHÔNG xuất hiện trong SUTTA_COUNTS
            result["valid_count"] = 0 

        else:
            # --- NORMAL MODE ---
            slim_meta_map = {}
            all_keys: Set[str] = set()
            collect_all_keys(structure, all_keys)
            all_keys.add(book_id)
            
            for k in all_keys:
                result["locator_map"][k] = book_id
                slim_meta_map[k] = _build_meta_entry(k, full_meta, nav_map, chunk_map_idx)
            
            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "title": data.get("title"),
                "tree": structure,
                "meta": slim_meta_map,
                "random_pool": linear_uids
            })
            result["valid_count"] = len(linear_uids)

        result["status"] = "success"
        return result

    except Exception as e:
        logger.error(f"❌ Worker failed on {file_path.name}: {e}")
        return result