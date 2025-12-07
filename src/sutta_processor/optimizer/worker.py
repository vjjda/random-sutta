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
    nav_map = {}
    total = len(linear_uids)
    for i, uid in enumerate(linear_uids):
        nav_entry = {}
        if i > 0: nav_entry["p"] = linear_uids[i-1]
        if i < total - 1: nav_entry["n"] = linear_uids[i+1]
        if nav_entry: nav_map[uid] = nav_entry
    return nav_map

def _extract_sub_books(
    book_id: str, 
    structure: Any, 
    full_meta: Dict[str, Any]
) -> List[Tuple[str, List[str]]]:
    """
    Tách cấu trúc sách lớn thành các sách con.
    Hỗ trợ cấu trúc dạng Dict {"an": {"an1": ...}} hoặc List {"an": [{"an1": ...}]}
    """
    sub_books = []
    
    # 1. Tìm root content (nội dung bên trong key "an")
    root_content = structure
    if isinstance(structure, dict):
        if book_id in structure:
            root_content = structure[book_id]
        else:
            # Fallback nếu root key không khớp book_id
            root_content = list(structure.values())[0]

    # Helper xử lý 1 item con (vd: an1)
    def process_item(key, val):
        # Chỉ chấp nhận nếu key bắt đầu bằng book_id (vd: an1 starts with an)
        if key.startswith(book_id) and key != book_id:
            sub_uids = []
            _flatten_tree(val, full_meta, sub_uids)
            if sub_uids:
                sub_books.append((key, sub_uids))

    # 2. Duyệt qua children
    if isinstance(root_content, dict):
        # Cấu trúc: { "an1": [...], "an2": [...] }
        for k, v in root_content.items():
            process_item(k, v)
            
    elif isinstance(root_content, list):
        # Cấu trúc: [ {"an1": [...]}, {"an2": [...]} ]
        for item in root_content:
            if isinstance(item, dict):
                for k, v in item.items():
                    process_item(k, v)

    # Sort theo ID để đảm bảo thứ tự (an1, an2...)
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

        # 3. Metadata Processing
        is_split_mode = book_id in SPLIT_CONFIG
        
        # Biến đếm tổng valid uids cho sách mẹ
        valid_random_uids_total = []

        if is_split_mode:
            # --- SPLIT MODE (AN, SN) ---
            sub_books = _extract_sub_books(book_id, structure, full_meta)
            sub_book_ids = []

            if not sub_books:
                logger.warning(f"⚠️ {book_id}: Split mode enabled but no sub-books found. structure type: {type(structure)}")

            for sub_id, sub_uids in sub_books:
                sub_meta_map = {}
                sub_valid_uids = []
                
                # Build Meta cho sách con
                for uid in sub_uids:
                    info = full_meta.get(uid, {})
                    m_type = info.get("type")
                    
                    entry = {
                        "acronym": info.get("acronym"),
                        "title": info.get("translated_title") or info.get("original_title"),
                        "type": m_type
                    }
                    if uid in nav_map: entry["nav"] = nav_map[uid]
                    if uid in chunk_map_idx: entry["c"] = chunk_map_idx[uid]
                    if m_type == "subleaf":
                        if "extract_id" in info: entry["eid"] = info["extract_id"]
                        if "parent_uid" in info: entry["pid"] = info["parent_uid"]
                    
                    sub_meta_map[uid] = entry
                    
                    if m_type in ["leaf", "subleaf"]:
                        sub_valid_uids.append(uid)
                        # Locator trỏ về sách con (an1)
                        result["locator_map"][uid] = sub_id 
                
                # Save Sub-Book Meta (an1.json)
                io.save_category("meta", f"{sub_id}.json", {
                    "id": sub_id,
                    "title": f"{sub_id.upper()}",
                    # Với sách con, ta fake structure đơn giản để FE vẽ được list
                    "tree": {sub_id: structure.get(book_id, {}).get(sub_id, sub_uids)}, 
                    "meta": sub_meta_map,
                    "uids": sub_valid_uids
                })
                
                sub_book_ids.append(sub_id)
                valid_random_uids_total.extend(sub_valid_uids)

            # Save Super-Book Meta (an.json)
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
                info = full_meta.get(uid, {})
                m_type = info.get("type")
                entry = {
                    "acronym": info.get("acronym"),
                    "title": info.get("translated_title") or info.get("original_title"),
                    "type": m_type
                }
                if uid in nav_map: entry["nav"] = nav_map[uid]
                if uid in chunk_map_idx: entry["c"] = chunk_map_idx[uid]
                if m_type == "subleaf":
                    if "extract_id" in info: entry["eid"] = info["extract_id"]
                    if "parent_uid" in info: entry["pid"] = info["parent_uid"]

                slim_meta_map[uid] = entry
                
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