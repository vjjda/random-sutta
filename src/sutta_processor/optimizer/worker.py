# Path: src/sutta_processor/optimizer/worker.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..shared.app_config import STAGE_PROCESSED_DIR
from .io_manager import IOManager
from .chunker import chunk_content_with_meta

logger = logging.getLogger("Optimizer.Worker")

def _flatten_tree(node: Any, meta_map: Dict[str, Any], result_list: List[str]) -> None:
    """Đệ quy làm phẳng cây structure để lấy thứ tự đọc tuyến tính."""
    if isinstance(node, str):
        # Chỉ thêm vào list nếu nó là LEAF hoặc SUBLEAF (có nội dung đọc được)
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
    """Tính toán Prev/Next cho từng UID trong sách."""
    nav_map = {}
    total = len(linear_uids)
    
    for i, uid in enumerate(linear_uids):
        prev_uid = linear_uids[i-1] if i > 0 else None
        next_uid = linear_uids[i+1] if i < total - 1 else None
        
        nav_entry = {}
        if prev_uid: nav_entry["p"] = prev_uid # p = prev
        if next_uid: nav_entry["n"] = next_uid # n = next
        
        if nav_entry:
            nav_map[uid] = nav_entry
            
    return nav_map

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
        linear_uids: List[str] = []
        _flatten_tree(structure, full_meta, linear_uids)
        nav_map = _build_nav_map(linear_uids)
        
        # 2. Build Slim Meta Map
        slim_meta_map = {}
        valid_random_uids = [] 

        for uid, info in full_meta.items():
            m_type = info.get("type")
            
            # Chỉ giữ thông tin thiết yếu
            entry: Dict[str, Any] = {
                "acronym": info.get("acronym"),
                "title": info.get("translated_title") or info.get("original_title"),
                "type": m_type
            }
            
            # Gán Pre-calculated Nav
            if uid in nav_map:
                entry["nav"] = nav_map[uid]
            
            # Logic Subleaf: Kế thừa extract_id và parent_uid
            if m_type == "subleaf":
                if "extract_id" in info: entry["eid"] = info["extract_id"]
                if "parent_uid" in info: entry["pid"] = info["parent_uid"]

            slim_meta_map[uid] = entry
            
            # Logic Random Pool: Subleaf/Leaf OK, Alias NO
            if m_type in ["leaf", "subleaf"]:
                valid_random_uids.append(uid)
                result["locator_map"][uid] = book_id

        # 3. Process Content & Assign Chunks
        raw_content = data.get("content", {})
        
        if raw_content:
            # Chunking logic giữ nguyên, chỉ thay đổi đầu ra
            chunks = chunk_content_with_meta(book_id, raw_content, full_meta)
            
            for idx, (fname, chunk_data) in enumerate(chunks):
                # Lưu vào thư mục 'content/'
                io.save_category("content", f"{fname}.json", chunk_data)
                
                # Cập nhật Slim Meta: Chỉ lưu index chunk (0, 1...) -> FE tự suy ra tên file
                for uid in chunk_data.keys():
                    if uid in slim_meta_map:
                        slim_meta_map[uid]["c"] = idx 

        # 4. Save Meta Pack (assets/db/meta/{book}.json)
        meta_pack = {
            "id": book_id,
            "title": data.get("title"),
            "tree": structure,    # Để vẽ Menu
            "meta": slim_meta_map, # Metadata tra cứu nhanh
            "uids": valid_random_uids # Local Pool cho Random
        }
        
        io.save_category("meta", f"{book_id}.json", meta_pack)

        # 5. Finalize
        result["status"] = "success"
        result["valid_count"] = len(valid_random_uids)
        
        return result

    except Exception as e:
        logger.error(f"❌ Worker failed on {file_path.name}: {e}")
        return result