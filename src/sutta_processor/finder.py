# Path: src/sutta_processor/finder.py
import logging
import os
from pathlib import Path
from typing import Dict, List, Tuple
import re

from .config import DATA_ROOT

logger = logging.getLogger("SuttaProcessor")

def find_sutta_files(sutta_id: str, root_file_path: Path) -> Dict[str, Path]:
    # Giữ nguyên logic tìm file phụ trợ (translation, html, comment)
    files = {'root': root_file_path}
    try:
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

def _identify_book_group(rel_parts: Tuple[str, ...]) -> str:
    """
    Xác định Book ID từ đường dẫn tương đối.
    Input (parts): ('sutta', 'mn', 'mn1_...') -> Output: 'sutta/mn'
    Input (parts): ('sutta', 'kn', 'dhp', 'dhp1_...') -> Output: 'sutta/kn/dhp'
    """
    if not rel_parts:
        return "uncategorized"
    
    category = rel_parts[0] # sutta, vinaya, abhidhamma
    
    if category == 'sutta':
        # Sutta/MN
        if len(rel_parts) >= 2 and rel_parts[1] != 'kn':
            return f"sutta/{rel_parts[1]}"
        # Sutta/KN/DHP
        if len(rel_parts) >= 3 and rel_parts[1] == 'kn':
            return f"sutta/kn/{rel_parts[2]}"
            
    elif category in ['vinaya', 'abhidhamma']:
        # Vinaya/Pli-tv-bi-vb
        if len(rel_parts) >= 2:
            return f"{category}/{rel_parts[1]}"
            
    return "uncategorized"

def generate_book_tasks(limit: int = 0) -> Dict[str, List[Tuple[str, Path]]]:
    """
    Quét toàn bộ thư mục root và nhóm các task theo Book.
    Trả về: { 'sutta/mn': [(mn1, path), (mn2, path)...], ... }
    """
    base_search_dir = DATA_ROOT / "root"
    if not base_search_dir.exists():
        raise FileNotFoundError(f"Data directory missing: {base_search_dir}")

    logger.info(f"Scanning {base_search_dir} and grouping by books...")
    
    # Dictionary chứa: Key = BookID, Value = List of Tasks
    book_tasks: Dict[str, List[Tuple[str, Path]]] = {}
    
    count = 0
    for root, dirs, files in os.walk(base_search_dir):
        # Tính toán Book ID dựa trên folder hiện tại
        try:
            current_path = Path(root)
            rel_path = current_path.relative_to(base_search_dir)
            
            # Chỉ xử lý nếu folder hiện tại chứa file json (lá của cây thư mục)
            # Tuy nhiên, ta cần xác định Book Group cho từng file để chính xác nhất
            pass 
        except ValueError:
            continue

        for file in files:
            if file.endswith(".json") and "_root-" in file:
                sutta_id = file.split("_")[0]
                full_path = Path(root) / file
                
                # Xác định file này thuộc book nào
                rel_parts = full_path.relative_to(base_search_dir).parts
                group_id = _identify_book_group(rel_parts)
                
                if group_id == "uncategorized":
                    continue

                if group_id not in book_tasks:
                    book_tasks[group_id] = []
                
                book_tasks[group_id].append((sutta_id, full_path))
                count += 1
                
                if limit > 0 and count >= limit:
                    break
        if limit > 0 and count >= limit:
            break

    # Sort danh sách bài kinh trong mỗi cuốn sách
    for group in book_tasks:
        book_tasks[group].sort(key=lambda x: x[0]) # Sort theo sutta_id

    # Sort danh sách các cuốn sách để xử lý theo thứ tự đẹp
    sorted_books = dict(sorted(book_tasks.items()))
    
    logger.info(f"✅ Found {count} suttas across {len(sorted_books)} books.")
    return sorted_books