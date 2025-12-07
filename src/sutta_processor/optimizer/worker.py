# Path: src/sutta_processor/optimizer/worker.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from ..shared.app_config import STAGE_PROCESSED_DIR
from .io_manager import IOManager
from .chunker import chunk_content_with_meta

logger = logging.getLogger("Optimizer.Worker")

# Các sách cần chia nhỏ
SPLIT_CONFIG = {
    "an": "nipata",
    "sn": "vagga"
}

def _flatten_tree(node: Any, meta_map: Dict[str, Any], result_list: List[str]) -> None:
    """Đệ quy làm phẳng cây structure để lấy thứ tự đọc tuyến tính."""
    if isinstance(node, str):
        m_type = meta_map.get(node, {}).get("type")
        if m_type in ["leaf", "subleaf"]:
            result_list.append(node)
    elif isinstance(node, list):
        for child in node:
            _flatten_tree(child, meta_map, result_list)
    elif isinstance(node, dict):
        for value in node.values():
            _flatten_tree(value, meta_map, result_list)

def _build_nav_map(linear_uids: List[str]) -> Dict[str, Dict[str, str]]:
    """Tính toán Prev/Next."""
    nav_map = {}
    total = len(linear_uids)
    for i, uid in enumerate(linear_uids):
        nav_entry = {}
        if i > 0: nav_entry["prev"] = linear_uids[i-1] # [CHANGED] p -> prev
        if i < total - 1: nav_entry["next"] = linear_uids[i+1] # [CHANGED] n -> next
        if nav_entry: nav_map[uid] = nav_entry
    return nav_map

def _extract_sub_books(
    book_id: str, 
    structure: Any, 
    full_meta: Dict[str, Any]
) -> List[Tuple[str, List[str]]]:
    """Tách cấu trúc sách lớn thành các sách con."""
    sub_books = []
    
    root_content = structure
    if isinstance(structure, dict):
        if book_id in structure:
            root_content = structure[book_id]
        else:
            root_content = list(structure.values())[0]

    def process_item(key, val):
        if key.startswith(book_id) and key != book_id:
            sub_uids = []
            _flatten_tree(val, full_meta, sub_uids)
            if sub_uids:
                sub_books.append((key, sub_uids))

    if isinstance(root_content, dict):
        for k, v in root_content.items():
            process_item(k, v)
    elif isinstance(root_content, list):
        for item in root_content:
            if isinstance(item, dict):
                for k, v in item.items():
                    process_item(k, v)

    sub_books.sort(key=lambda x: x[0])
    return sub_books

def process_book_task(file_path: Path, dry_run: bool) -> Dict[str, Any]:
    io = IOManager(dry_run)
    result = {
        "status": "error", 
        "book_id": "", 
        "valid_count": 0, 
        "locator_map": {} 
    }

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        book_id = data.get("id", "").lower()
        result["book_id"] = book_id
        
        full_meta = data.get("meta", {})
        structure = data.get("structure", {})
        
        # 1. Linearize & Nav Calculation
        linear_uids = []
        _flatten_tree(structure, full_meta, linear_uids)
        nav_map = _build_nav_map(linear_uids)
        
        # 2. Content & Chunking
        chunk_map_idx = {}
        raw_content = data.get("content", {})
        if raw_content:
            chunks = chunk_content_with_meta(book_id, raw_content, full_meta)
            for idx, (fname, chunk_data) in enumerate(chunks):
                io.save_category("content", f"{fname}.json", chunk_data)
                for uid in chunk_data.keys():
                    chunk_map_idx[uid] = idx

        # 3. Metadata Processing Helpers
        def build_entry(uid):
            info = full_meta.get(uid, {})
            m_type = info.get("type")
            
            # [CHANGED] Khôi phục các trường thông tin và dùng key tường minh
            entry = {
                "acronym": info.get("acronym"),
                "translated_title": info.get("translated_title"),
                "original_title": info.get("original_title"), # [RESTORED]
                "author_uid": info.get("author_uid"),         # [RESTORED]
                "type": m_type
            }
            
            # Chỉ thêm blurb nếu có để tiết kiệm dung lượng (nhưng vẫn giữ lại)
            if info.get("blurb"):
                entry["blurb"] = info.get("blurb")            # [RESTORED]

            if uid in nav_map: 
                entry["nav"] = nav_map[uid]
            
            if uid in chunk_map_idx: 
                entry["chunk"] = chunk_map_idx[uid]           # [CHANGED] c -> chunk

            if m_type == "subleaf":
                if "extract_id" in info: 
                    entry["extract_id"] = info["extract_id"]  # [CHANGED] eid -> extract_id
                if "parent_uid" in info: 
                    entry["parent_uid"] = info["parent_uid"]  # [CHANGED] pid -> parent_uid
            
            return entry

        is_split_mode = book_id in SPLIT_CONFIG
        valid_random_uids_total = []

        if is_split_mode:
            # --- SPLIT MODE ---
            sub_books = _extract_sub_books(book_id, structure, full_meta)
            sub_book_ids = []

            for sub_id, sub_uids in sub_books:
                sub_meta_map = {}
                sub_valid_uids = []
                
                for uid in sub_uids:
                    sub_meta_map[uid] = build_entry(uid)
                    m_type = full_meta.get(uid, {}).get("type")
                    
                    if m_type in ["leaf", "subleaf"]:
                        sub_valid_uids.append(uid)
                        result["locator_map"][uid] = sub_id 
                
                io.save_category("meta", f"{sub_id}.json", {
                    "id": sub_id,
                    "title": f"{sub_id.upper()}",
                    "tree": {sub_id: structure.get(book_id, {}).get(sub_id, sub_uids)}, 
                    "meta": sub_meta_map,
                    "uids": sub_valid_uids
                })
                
                sub_book_ids.append(sub_id)
                valid_random_uids_total.extend(sub_valid_uids)

            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "type": "super_group",
                "title": data.get("title"),
                "children": sub_book_ids
            })

        else:
            # --- NORMAL MODE ---
            slim_meta_map = {}
            for uid in linear_uids:
                slim_meta_map[uid] = build_entry(uid)
                m_type = full_meta.get(uid, {}).get("type")
                
                if m_type in ["leaf", "subleaf"]:
                    valid_random_uids_total.append(uid)
                    result["locator_map"][uid] = book_id

            io.save_category("meta", f"{book_id}.json", {
                "id": book_id,
                "title": data.get("title"),
                "tree": structure,
                "meta": slim_meta_map,
                "uids": valid_random_uids_total
            })

        result["status"] = "success"
        result["valid_count"] = len(valid_random_uids_total)
        return result

    except Exception as e:
        logger.error(f"❌ Worker failed on {file_path.name}: {e}")
        return result