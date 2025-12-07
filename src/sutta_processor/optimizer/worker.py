# Path: src/sutta_processor/optimizer/worker.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List

from .io_manager import IOManager
from .chunker import chunk_content_with_meta
from .tree_utils import flatten_tree_uids, build_nav_map
from .splitter import is_split_book, extract_sub_books

logger = logging.getLogger("Optimizer.Worker")

def _build_meta_entry(uid: str, full_meta: Dict, nav_map: Dict, chunk_map: Dict) -> Dict[str, Any]:
    """Helper tạo object metadata chuẩn."""
    info = full_meta.get(uid, {})
    m_type = info.get("type")
    
    entry = {
        "acronym": info.get("acronym"),
        "translated_title": info.get("translated_title"),
        "original_title": info.get("original_title"),
        "author_uid": info.get("author_uid"),
        "type": m_type
    }
    
    if info.get("blurb"): entry["blurb"] = info.get("blurb")
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
        
        # 1. Tính toán Nav toàn cục (cho cả sách mẹ để link xuyên suốt)
        linear_uids = []
        flatten_tree_uids(structure, full_meta, linear_uids)
        nav_map = build_nav_map(linear_uids)
        
        # 2. Xử lý Content (Chunking)
        chunk_map_idx = {}
        raw_content = data.get("content", {})
        if raw_content:
            chunks = chunk_content_with_meta(book_id, raw_content, full_meta)
            for idx, (fname, chunk_data) in enumerate(chunks):
                io.save_category("content", f"{fname}.json", chunk_data)
                for uid in chunk_data.keys():
                    chunk_map_idx[uid] = idx

        # 3. Xử lý Metadata (Chia trường hợp Split/Normal)
        valid_uids_total = []

        if is_split_book(book_id):
            # --- CASE A: SPLIT BOOK (AN, SN) ---
            sub_books = extract_sub_books(book_id, structure, full_meta)
            sub_book_ids = []

            for sub_id, sub_uids in sub_books:
                sub_meta_map = {}
                sub_valid_uids = []
                
                for uid in sub_uids:
                    sub_meta_map[uid] = _build_meta_entry(uid, full_meta, nav_map, chunk_map_idx)
                    result["locator_map"][uid] = sub_id # Trỏ về sách con
                    
                    if full_meta.get(uid, {}).get("type") in ["leaf", "subleaf"]:
                        sub_valid_uids.append(uid)

                # Save Sub-Book Meta
                io.save_category("meta", f"{sub_id}.json", {
                    "id": sub_id,
                    "title": f"{sub_id.upper()}",
                    "tree": {sub_id: structure.get(book_id, {}).get(sub_id, sub_uids)},
                    "meta": sub_meta_map,
                    "uids": sub_valid_uids
                })
                
                sub_book_ids.append(sub_id)
                valid_uids_total.extend(sub_valid_uids)

            # Save Super-Book Meta
            result["locator_map"][book_id] = book_id
            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "type": "super_group",
                "title": data.get("title"),
                "children": sub_book_ids
            })

        else:
            # --- CASE B: NORMAL BOOK ---
            slim_meta_map = {}
            # Duyệt qua full_meta để đảm bảo lấy cả Branch/Container
            for uid in full_meta.keys():
                slim_meta_map[uid] = _build_meta_entry(uid, full_meta, nav_map, chunk_map_idx)
                result["locator_map"][uid] = book_id
                
                if full_meta.get(uid, {}).get("type") in ["leaf", "subleaf"]:
                    valid_uids_total.append(uid)
            
            # Map chính book_id
            result["locator_map"][book_id] = book_id

            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "title": data.get("title"),
                "tree": structure,
                "meta": slim_meta_map,
                "uids": valid_uids_total
            })

        result["status"] = "success"
        result["valid_count"] = len(valid_uids_total)
        return result

    except Exception as e:
        logger.error(f"❌ Worker failed on {file_path.name}: {e}")
        return result