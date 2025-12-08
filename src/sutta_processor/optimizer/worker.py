# Path: src/sutta_processor/optimizer/worker.py
import json
import logging
import traceback
from pathlib import Path
from typing import Dict, Any, List, Set

from .io_manager import IOManager
from .chunker import chunk_content
from .tree_utils import flatten_tree_uids, collect_all_keys, build_nav_map
from .splitter import is_split_book, extract_sub_books

logger = logging.getLogger("Optimizer.Worker")

def _build_meta_entry(uid: str, full_meta: Dict, nav_map: Dict, chunk_map: Dict) -> Dict[str, Any]:
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
        
        # 1. Nav & Random (Global)
        linear_uids = []
        flatten_tree_uids(structure, full_meta, linear_uids)
        nav_map = build_nav_map(linear_uids)
        
        # 2. Content
        chunk_map_idx = {}
        raw_content = data.get("content", {})
        if raw_content:
            chunks = chunk_content(book_id, raw_content)
            for idx, (fname, chunk_data) in enumerate(chunks):
                io.save_category("content", f"{fname}.json", chunk_data)
                for uid in chunk_data.keys():
                    chunk_map_idx[uid] = idx

        # 3. Metadata Processing
        if is_split_book(book_id):
            # --- SPLIT MODE ---
            sub_books = extract_sub_books(book_id, structure, full_meta)
            sub_book_ids = []
            root_title = data.get("title", "")
            
            # [NEW] Chuẩn bị Meta cho Super Book (để hiển thị Menu)
            super_meta_map = {}
            # Inject chính nó vào
            if book_id in full_meta:
                super_meta_map[book_id] = _build_meta_entry(book_id, full_meta, nav_map, chunk_map_idx)

            for sub_id, all_sub_keys, sub_struct in sub_books:
                sub_meta_map = {}
                sub_leaves = []
                
                # A. Build Sub-Book Meta
                for k in all_sub_keys:
                    result["locator_map"][k] = [sub_id, None] # Default locator (sẽ update chunk sau)
                    
                    # Logic update chunk index cho locator
                    # (Code cũ đã có logic này trong _get_chunk_idx nhưng ở đây ta làm đơn giản hóa để focus vào Meta)
                    if k in chunk_map_idx:
                        result["locator_map"][k] = [sub_id, chunk_map_idx[k]]
                    
                    sub_meta_map[k] = _build_meta_entry(k, full_meta, nav_map, chunk_map_idx)
                    
                    m_type = full_meta.get(k, {}).get("type")
                    if m_type in ["leaf", "subleaf"]:
                        sub_leaves.append(k)

                # Inject Parent vào Sub-Book
                if book_id in full_meta:
                    sub_meta_map[book_id] = _build_meta_entry(book_id, full_meta, nav_map, chunk_map_idx)
                
                final_tree = { book_id: { sub_id: sub_struct } }

                # Save Sub-Book
                io.save_category("meta", f"{sub_id}.json", {
                    "id": sub_id,
                    "title": f"{sub_id.upper()}",
                    "root_id": book_id,
                    "root_title": root_title,
                    "tree": final_tree, 
                    "meta": sub_meta_map,
                    "random_pool": sub_leaves
                })
                
                # B. Collect Info for Super Book
                sub_book_ids.append(sub_id)
                result["sub_counts"][sub_id] = len(sub_leaves)
                
                # [NEW] Đưa Meta của con trực tiếp (an1) lên cha (an)
                # Để frontend vẽ được list an1, an2... mà có title đầy đủ
                if sub_id in full_meta:
                    super_meta_map[sub_id] = _build_meta_entry(sub_id, full_meta, nav_map, chunk_map_idx)
                else:
                    # Fallback nếu sub_id không có trong meta gốc (hiếm)
                    super_meta_map[sub_id] = { "acronym": sub_id.upper(), "type": "branch" }

            # Save Super-Book (Standardized Structure)
            result["locator_map"][book_id] = [book_id, None]
            
            # Tree của Super Book chỉ chứa các con trực tiếp
            super_tree = { book_id: sub_book_ids }

            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "title": root_title,
                "type": "super_group", # Vẫn giữ type này để frontend nhận biết nếu cần
                "tree": super_tree,    # [CHANGED] Chuẩn hóa Tree
                "meta": super_meta_map,# [CHANGED] Meta chứa thông tin các con
                "random_pool": [],     # Empty (Dùng constants.js để random)
                "child_counts": result["sub_counts"] # Giữ lại để tham khảo hoặc UI hiển thị số lượng
            })
            result["valid_count"] = 0 

        else:
            # --- NORMAL MODE ---
            # (Giữ nguyên logic cũ, chỉ update locator format list)
            slim_meta_map = {}
            all_keys = set()
            collect_all_keys(structure, all_keys)
            all_keys.add(book_id)
            
            # Quét thêm meta keys để vợt alias
            for k in full_meta.keys(): all_keys.add(k)

            for k in all_keys:
                c_idx = chunk_map_idx.get(k)
                result["locator_map"][k] = [book_id, c_idx]
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
        traceback.print_exc()
        return result