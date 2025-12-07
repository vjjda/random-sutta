# Path: src/sutta_processor/optimizer/worker.py
import json
import logging
import traceback
from pathlib import Path
from typing import Dict, Any, List, Set

from .io_manager import IOManager
from .chunker import chunk_content_with_meta
from .tree_utils import flatten_tree_uids, build_nav_map
from .splitter import is_split_book, extract_sub_books

logger = logging.getLogger("Optimizer.Worker")

def _build_meta_entry(uid: str, full_meta: Dict, nav_map: Dict, chunk_map: Dict) -> Dict[str, Any]:
    info = full_meta.get(uid, {})
    m_type = info.get("type", "branch")
    
    # 1. Alias: Chỉ cần Target
    if m_type == "alias":
        target = info.get("extract_id") or info.get("parent_uid")
        return { "type": "alias", "target_uid": target }

    # 2. Các loại khác: Full Info
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
    result = { "status": "error", "book_id": "", "valid_count": 0, "locator_map": {}, "sub_counts": {} }

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        book_id = data.get("id", "").lower()
        result["book_id"] = book_id
        
        full_meta = data.get("meta", {})
        structure = data.get("structure", {})
        
        # 1. Nav & Random Pool (Dựa trên Tree để đảm bảo thứ tự đọc)
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

        # 3. Metadata Processing & Indexing
        # Single Source of Truth: full_meta
        
        if is_split_book(book_id):
            # --- SPLIT MODE ---
            # splitter đã gom nhóm key dựa trên structure + orphan meta
            sub_books = extract_sub_books(book_id, structure, full_meta)
            sub_book_ids = []
            root_title = data.get("title", "")

            for sub_id, all_sub_keys, sub_struct in sub_books:
                sub_meta_map = {}
                
                # Filter Random Pool cho sách con (chỉ lấy những uid nằm trong sub_struct)
                # Dùng linear_uids để giữ thứ tự, filter những cái thuộc về sub_id
                # (Cách đơn giản: flatten lại sub_struct)
                sub_pool = []
                flatten_tree_uids(sub_struct, full_meta, sub_pool)

                # Build Meta & Locator từ danh sách keys đã được splitter gom
                for k in all_sub_keys:
                    result["locator_map"][k] = sub_id
                    sub_meta_map[k] = _build_meta_entry(k, full_meta, nav_map, chunk_map_idx)

                # Inject Parent (Root) Meta vào sách con
                if book_id in full_meta:
                    sub_meta_map[book_id] = _build_meta_entry(book_id, full_meta, nav_map, chunk_map_idx)
                
                # Reconstruct Tree Root
                final_tree = { book_id: { sub_id: sub_struct } }

                io.save_category("meta", f"{sub_id}.json", {
                    "id": sub_id,
                    "title": f"{sub_id.upper()}",
                    "root_id": book_id,
                    "root_title": root_title,
                    "tree": final_tree, 
                    "meta": sub_meta_map,
                    "random_pool": sub_pool
                })
                
                sub_book_ids.append(sub_id)
                result["sub_counts"][sub_id] = len(sub_pool)

            # Super-Book Indexing
            result["locator_map"][book_id] = book_id
            
            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "type": "super_group",
                "title": root_title,
                "children": sub_book_ids,
                "child_counts": result["sub_counts"]
            })
            result["valid_count"] = 0 

        else:
            # --- NORMAL MODE ---
            slim_meta_map = {}
            
            # [SIMPLE LOGIC] Duyệt toàn bộ Meta -> Đây là Truth!
            # Bao gồm cả Branch, Leaf, Subleaf, Alias
            for uid, info in full_meta.items():
                slim_meta_map[uid] = _build_meta_entry(uid, full_meta, nav_map, chunk_map_idx)
                result["locator_map"][uid] = book_id
            
            # Map chính ID sách (thường đã có trong meta, nhưng map lại cho chắc)
            result["locator_map"][book_id] = book_id

            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "title": data.get("title"),
                "tree": structure,
                "meta": slim_meta_map,
                "random_pool": linear_uids # Pool lấy từ Tree Flatten
            })
            result["valid_count"] = len(linear_uids)

        result["status"] = "success"
        return result

    except Exception as e:
        logger.error(f"❌ Worker failed on {file_path.name}: {e}")
        traceback.print_exc()
        return result