# Path: src/sutta_processor/optimizer/worker.py
import json
import logging
import traceback
from pathlib import Path
from typing import Dict, Any, List, Set

from .io_manager import IOManager
from .chunker import chunk_content_with_meta
from .tree_utils import flatten_tree_uids, collect_all_keys, build_nav_map, prune_tree_aliases # [NEW]
from .splitter import is_split_book, extract_sub_books

logger = logging.getLogger("Optimizer.Worker")

def _build_meta_entry(uid: str, full_meta: Dict, nav_map: Dict, chunk_map: Dict) -> Dict[str, Any]:
    info = full_meta.get(uid, {})
    m_type = info.get("type", "branch")
    
    # Alias tối giản
    if m_type == "alias":
        target = info.get("extract_id") or info.get("parent_uid")
        return {
            "type": "alias",
            "target_uid": target
        }

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
            # --- SPLIT MODE ---
            sub_books = extract_sub_books(book_id, structure, full_meta)
            sub_book_ids = []
            root_title = data.get("title", "")

            for sub_id, sub_leaves, sub_struct in sub_books:
                sub_meta_map = {}
                all_sub_keys: Set[str] = set()
                collect_all_keys(sub_struct, all_sub_keys)
                all_sub_keys.add(sub_id)
                
                for k in all_sub_keys:
                    result["locator_map"][k] = sub_id
                    sub_meta_map[k] = _build_meta_entry(k, full_meta, nav_map, chunk_map_idx)

                if book_id in full_meta:
                    sub_meta_map[book_id] = _build_meta_entry(book_id, full_meta, nav_map, chunk_map_idx)
                
                final_tree = { book_id: { sub_id: sub_struct } }
                
                # [NEW] Làm sạch Tree trước khi lưu
                clean_tree = prune_tree_aliases(final_tree, full_meta)

                io.save_category("meta", f"{sub_id}.json", {
                    "id": sub_id,
                    "title": f"{sub_id.upper()}",
                    "root_id": book_id,
                    "root_title": root_title,
                    "tree": clean_tree, # Saved Clean Tree
                    "meta": sub_meta_map, # Meta vẫn chứa alias
                    "random_pool": sub_leaves
                })
                
                sub_book_ids.append(sub_id)
                result["sub_counts"][sub_id] = len(sub_leaves)

            # Save Super-Book
            result["locator_map"][book_id] = book_id
            
            # Super book tree cũng cần clean (nếu nó chứa alias ở level cao, dù ít gặp)
            clean_struct = prune_tree_aliases(structure, full_meta)
            
            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "type": "super_group",
                "title": root_title,
                "tree": clean_struct,
                "children": sub_book_ids,
                "child_counts": result["sub_counts"]
            })
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
            
            # [NEW] Làm sạch Tree
            clean_tree = prune_tree_aliases(structure, full_meta)

            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "title": data.get("title"),
                "tree": clean_tree, # Saved Clean Tree
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