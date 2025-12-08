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

logger = logging.getLogger("Optimizer.Worker")

def _build_meta_entry(uid: str, full_meta: Dict, nav_map: Dict, chunk_idx: Optional[int]) -> Dict[str, Any]:
    info = full_meta.get(uid, {})
    m_type = info.get("type", "branch")
    
    if m_type == "alias":
        target = info.get("extract_id") or info.get("parent_uid")
        return { "type": "alias", "target_uid": target }

    entry = {}
    if info.get("acronym"): entry["acronym"] = info["acronym"]
    if info.get("translated_title"): entry["translated_title"] = info["translated_title"]
    if info.get("original_title"): entry["original_title"] = info["original_title"]
    if info.get("author_uid"): entry["author_uid"] = info["author_uid"]
    if info.get("blurb"): entry["blurb"] = info["blurb"]
    
    entry["type"] = m_type
    
    if uid in nav_map: entry["nav"] = nav_map[uid]
    
    # [FIX] Nhận chunk_idx đã resolve từ bên ngoài vào
    if chunk_idx is not None: 
        entry["chunk"] = chunk_idx

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
        
        # 1. Nav & Random
        linear_uids = []
        flatten_tree_uids(structure, full_meta, linear_uids)
        nav_map = build_nav_map(linear_uids)
        
        # [HELPER] Smart Chunk Resolver
        def resolve_chunk_idx(uid: str, current_chunk_map: Dict[str, int]) -> Optional[int]:
            # 1. Direct Hit (Leaf gốc)
            if uid in current_chunk_map:
                return current_chunk_map[uid]
            
            # 2. Indirect Hit (Subleaf / Alias)
            # Chúng thường trỏ về một Parent/Target có chứa nội dung
            info = full_meta.get(uid, {})
            
            # Ưu tiên Parent (Container File)
            parent = info.get("parent_uid")
            if parent and parent in current_chunk_map:
                return current_chunk_map[parent]
            
            # Fallback Extract ID (Target)
            extract = info.get("extract_id")
            if extract and extract in current_chunk_map:
                return current_chunk_map[extract]
                
            return None

        # 2. Metadata & Content Processing
        if is_split_book(book_id):
            # --- SPLIT MODE ---
            sub_books = extract_sub_books(book_id, structure, full_meta)
            sub_book_ids = []
            root_title = data.get("title", "")
            
            # Super Meta (Menu mẹ)
            super_meta_map = {}
            if book_id in full_meta:
                super_meta_map[book_id] = _build_meta_entry(book_id, full_meta, nav_map, None)

            total_valid_count = 0

            for sub_id, all_sub_keys, sub_struct in sub_books:
                sub_meta_map = {}
                sub_leaves = []
                
                # A. Content Chunking cho Sách Con
                # Lọc content thuộc sách con
                sub_content = {}
                sub_leaves_check = []
                flatten_tree_uids(sub_struct, full_meta, sub_leaves_check)
                
                # Lấy content thực tế (Content gốc nằm ở raw_content = data['content'])
                raw_content = data.get("content", {})
                for uid in sub_leaves_check:
                    if uid in raw_content:
                        sub_content[uid] = raw_content[uid]
                
                sub_chunk_map = {}
                if sub_content:
                    chunks = chunk_content(sub_id, sub_content)
                    for idx, (fname, chunk_data) in enumerate(chunks):
                        io.save_category("content", f"{fname}.json", chunk_data)
                        for uid in chunk_data.keys():
                            sub_chunk_map[uid] = idx

                # B. Build Meta & Locator
                for k in all_sub_keys:
                    # [FIX] Dùng hàm resolve thay vì get trực tiếp
                    c_idx = resolve_chunk_idx(k, sub_chunk_map)
                    
                    result["locator_map"][k] = [sub_id, c_idx]
                    sub_meta_map[k] = _build_meta_entry(k, full_meta, nav_map, c_idx)
                    
                    m_type = full_meta.get(k, {}).get("type")
                    if m_type in ["leaf", "subleaf"]:
                        sub_leaves.append(k)

                if book_id in full_meta:
                    sub_meta_map[book_id] = _build_meta_entry(book_id, full_meta, nav_map, None)
                
                if sub_id in full_meta:
                    super_meta_map[sub_id] = _build_meta_entry(sub_id, full_meta, nav_map, None)
                else:
                    super_meta_map[sub_id] = { "acronym": sub_id.upper(), "type": "branch" }

                final_tree = { book_id: { sub_id: sub_struct } }

                io.save_category("meta", f"{sub_id}.json", {
                    "id": sub_id,
                    "type": "sub_book",
                    "title": f"{sub_id.upper()}",
                    "super_book_id": book_id,
                    "super_book_title": root_title,
                    "tree": final_tree, 
                    "meta": sub_meta_map,
                    "random_pool": sub_leaves
                })
                
                sub_book_ids.append(sub_id)
                count = len(sub_leaves)
                result["sub_counts"][sub_id] = count
                total_valid_count += count

            # Save Super-Book
            result["locator_map"][book_id] = [book_id, None]
            super_tree = { book_id: sub_book_ids }

            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "type": "super_book",
                "title": root_title,
                "tree": super_tree,
                "meta": super_meta_map,
                "children": sub_book_ids
            })
            result["valid_count"] = total_valid_count
            result["sub_books_list"] = sub_book_ids

        else:
            # --- NORMAL MODE ---
            # Chunking Global
            normal_chunk_map = {}
            raw_content = data.get("content", {})
            if raw_content:
                chunks = chunk_content(book_id, raw_content)
                for idx, (fname, chunk_data) in enumerate(chunks):
                    io.save_category("content", f"{fname}.json", chunk_data)
                    for uid in chunk_data.keys():
                        normal_chunk_map[uid] = idx

            slim_meta_map = {}
            all_keys = set()
            collect_all_keys(structure, all_keys)
            all_keys.add(book_id)
            for k in full_meta.keys(): all_keys.add(k)

            for k in all_keys:
                # [FIX] Dùng hàm resolve
                c_idx = resolve_chunk_idx(k, normal_chunk_map)
                
                result["locator_map"][k] = [book_id, c_idx]
                slim_meta_map[k] = _build_meta_entry(k, full_meta, nav_map, c_idx)
            
            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "type": "book",
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
        traceback.print_exc()
        return result