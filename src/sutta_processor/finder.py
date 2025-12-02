# Path: src/sutta_processor/finder.py
import logging
import json
import os
from pathlib import Path
from typing import Dict, List, Tuple, Any

from .config import DATA_ROOT

logger = logging.getLogger("SuttaProcessor")

def find_sutta_files(sutta_id: str, root_file_path: Path) -> Dict[str, Path]:
    # ... (Giữ nguyên logic tìm file phụ trợ HTML/Trans/Comment như cũ) ...
    files = {'root': root_file_path}
    try:
        # Logic tìm file phụ trợ (Html, Trans...) giữ nguyên
        # Chỉ cần đảm bảo root_file_path là đúng
        rel_path = root_file_path.relative_to(DATA_ROOT / "root")
        collection_part = rel_path.parent 
        
        def find_in_dir(category: str, suffix_pattern: str):
            base_dir = DATA_ROOT / category / collection_part
            if base_dir.exists():
                found = list(base_dir.glob(f"{sutta_id}_{suffix_pattern}"))
                if found:
                    files[category] = found[0]

        find_in_dir("translation", "translation-en-*.json")
        find_in_dir("html", "html.json")
        find_in_dir("comment", "comment-*.json")
    except Exception as e:
        logger.warning(f"Path resolution error for {sutta_id}: {e}")
    return files

def _identify_book_group_from_tree(tree_file: Path) -> str:
    """
    Xác định group ID dựa vào vị trí file tree.
    data/bilara/tree/sutta/mn-tree.json -> sutta/mn
    data/bilara/tree/sutta/kn/dhp-tree.json -> sutta/kn/dhp
    """
    try:
        base_tree = DATA_ROOT / "tree"
        rel_path = tree_file.relative_to(base_tree)
        # rel_path: sutta/mn-tree.json hoặc sutta/kn/dhp-tree.json
        
        # Lấy parent path làm group prefix
        parent = rel_path.parent
        
        # Lấy tên file bỏ đuôi -tree.json làm book id
        book_id = tree_file.name.replace("-tree.json", "")
        
        return f"{parent}/{book_id}"
    except Exception:
        return "uncategorized"

def _extract_leaves_from_tree(node: Any) -> List[str]:
    """Đệ quy lấy danh sách UID (lá) từ cấu trúc tree."""
    leaves = []
    if isinstance(node, str):
        return [node]
    elif isinstance(node, list):
        for child in node:
            leaves.extend(_extract_leaves_from_tree(child))
    elif isinstance(node, dict):
        for key, children in node.items():
            leaves.extend(_extract_leaves_from_tree(children))
    return leaves

def _locate_root_file(sutta_id: str, group_path: str) -> Path:
    """
    Tìm file root json cho một sutta_id cụ thể.
    group_path: sutta/mn -> tìm trong data/bilara/root/sutta/mn
    """
    # Logic tìm kiếm file vật lý
    # 1. Thử tìm trong thư mục group tương ứng
    base_root = DATA_ROOT / "root" / group_path
    
    # Pattern chuẩn: mn1_root-pli-ms.json
    pattern = f"{sutta_id}_root-*.json"
    
    # [Optimize] Nếu biết chắc folder, tìm trực tiếp
    if base_root.exists():
        found = list(base_root.glob(pattern))
        if found:
            return found[0]
            
    # Fallback: Nếu không tìm thấy (ví dụ file lẻ ở vinaya), quét rộng hơn một chút
    # Hoặc dùng rglob từ cấp cha
    parent_search = base_root.parent
    if parent_search.exists():
        found = list(parent_search.rglob(pattern))
        if found:
            return found[0]
            
    return None

def generate_book_tasks(limit: int = 0) -> Dict[str, List[Tuple[str, Path]]]:
    """
    1. Quét folder 'tree' để tìm danh sách các cuốn sách.
    2. Parse mỗi file tree để lấy danh sách bài kinh (Leaves) theo THỨ TỰ CHUẨN.
    3. Tìm file root tương ứng cho mỗi bài kinh.
    """
    tree_dir = DATA_ROOT / "tree"
    if not tree_dir.exists():
        raise FileNotFoundError(f"Tree directory missing: {tree_dir}")

    logger.info(f"🌲 Scanning Tree files in {tree_dir} for canonical ordering...")
    
    book_tasks: Dict[str, List[Tuple[str, Path]]] = {}
    total_suttas = 0
    
    # Tìm tất cả file *-tree.json
    tree_files = sorted(list(tree_dir.rglob("*-tree.json")))
    
    for tree_file in tree_files:
        if tree_file.name == "super-tree.json":
            continue
            
        group_id = _identify_book_group_from_tree(tree_file)
        
        try:
            with open(tree_file, "r", encoding="utf-8") as f:
                tree_data = json.load(f)
                
            # Trích xuất danh sách bài kinh theo thứ tự
            ordered_uids = _extract_leaves_from_tree(tree_data)
            
            tasks = []
            for uid in ordered_uids:
                # Tìm file vật lý
                root_path = _locate_root_file(uid, group_id)
                if root_path:
                    tasks.append((uid, root_path))
                else:
                    # Có thể xảy ra nếu tree có ID nhưng chưa fetch text về (ví dụ bản dịch chưa có)
                    # logger.debug(f"Missing root file for {uid} in {group_id}")
                    pass
            
            if tasks:
                book_tasks[group_id] = tasks
                total_suttas += len(tasks)
                
        except Exception as e:
            logger.error(f"Error parsing tree {tree_file.name}: {e}")

    logger.info(f"✅ Found {total_suttas} ordered suttas across {len(book_tasks)} books.")
    return book_tasks