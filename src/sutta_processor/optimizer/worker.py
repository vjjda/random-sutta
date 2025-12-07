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
    result = { "status": "error", "book_id": "", "valid_count": 0, "locator_map": {} }

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        book_id = data.get("id", "").lower()
        result["book_id"] = book_id
        
        full_meta = data.get("meta", {})
        structure = data.get("structure", {})
        
        # 1. Nav Calculation (Global) & Random Pool Source
        # linear_uids chính là danh sách sạch để làm Random Pool (chỉ chứa leaf/subleaf cuối cùng)
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
            # --- SPLIT MODE ---
            sub_books = extract_sub_books(book_id, structure, full_meta)
            sub_book_ids = []
            total_valid_count = 0

            for sub_id, sub_leaves, sub_struct in sub_books:
                sub_meta_map = {}
                
                # A. Locator: Thu thập TẤT CẢ keys (Branch + Leaf) trong sub_struct
                all_sub_keys: Set[str] = set()
                collect_all_keys(sub_struct, all_sub_keys)
                
                # Map Locator cho mọi key tìm thấy
                for k in all_sub_keys:
                    result["locator_map"][k] = sub_id
                    # Build Meta cho mọi key (kể cả Branch)
                    sub_meta_map[k] = _build_meta_entry(k, full_meta, nav_map, chunk_map_idx)

                # B. Random Pool: Chính là sub_leaves (đã được flatten)
                # sub_leaves đảm bảo không chứa Parent Container
                
                io.save_category("meta", f"{sub_id}.json", {
                    "id": sub_id,
                    "title": f"{sub_id.upper()}",
                    "tree": {sub_id: sub_struct}, 
                    "meta": sub_meta_map,
                    "random_pool": sub_leaves # [RENAMED]
                })
                
                sub_book_ids.append(sub_id)
                total_valid_count += len(sub_leaves)

            # Save Super-Book (Map Locator cho chính nó)
            result["locator_map"][book_id] = book_id
            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "type": "super_group",
                "title": data.get("title"),
                "children": sub_book_ids
            })
            result["valid_count"] = total_valid_count

        else:
            # --- NORMAL MODE ---
            slim_meta_map = {}
            
            # A. Locator: Thu thập TẤT CẢ keys từ structure
            all_keys: Set[str] = set()
            collect_all_keys(structure, all_keys)
            
            # Map Locator & Build Meta
            for k in all_keys:
                result["locator_map"][k] = book_id
                slim_meta_map[k] = _build_meta_entry(k, full_meta, nav_map, chunk_map_idx)
            
            # B. Random Pool: Chính là linear_uids (đã được flatten từ bước 1)
            
            result["locator_map"][book_id] = book_id # Map chính ID sách
            
            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "title": data.get("title"),
                "tree": structure,
                "meta": slim_meta_map,
                "random_pool": linear_uids # [RENAMED]
            })
            result["valid_count"] = len(linear_uids)

        result["status"] = "success"
        return result

    except Exception as e:
        logger.error(f"❌ Worker failed on {file_path.name}: {e}")
        return result