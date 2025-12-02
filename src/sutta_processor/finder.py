# Path: src/sutta_processor/finder.py
import logging
import os
from pathlib import Path
from typing import Dict, List, Tuple
import re

from .config import DATA_ROOT

logger = logging.getLogger("SuttaProcessor")

def find_sutta_files(sutta_id: str, root_file_path: Path) -> Dict[str, Path]:
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

def _identify_book_group(rel_parts: Tuple[str, ...], file_name: str) -> str:
    """
    Xác định Book ID từ đường dẫn tương đối.
    Input: ('sutta', 'mn', 'mn1.json') -> Output: 'sutta/mn'
    Input: ('vinaya', 'pli-tv-bi-pm_root...') -> Output: 'vinaya/pli-tv-bi-pm'
    """
    if not rel_parts:
        return "uncategorized"
    
    category = rel_parts[0] # sutta, vinaya, abhidhamma
    
    if category == 'sutta':
        # Sutta/MN/file.json -> len=3
        if len(rel_parts) > 1:
            if rel_parts[1] == 'kn':
                # Sutta/KN/DHP/file.json -> len=4 -> sutta/kn/dhp
                if len(rel_parts) > 2:
                    return f"sutta/kn/{rel_parts[2]}"
                # Fallback: Sutta/KN/file.json (Hiếm)
                return f"sutta/kn/{file_name.split('_')[0]}"
            # Sutta/MN
            return f"sutta/{rel_parts[1]}"
            
    elif category in ['vinaya', 'abhidhamma']:
        # Trường hợp 1: File nằm lẻ ngay trong root category (Structure nông)
        # Ví dụ: vinaya/pli-tv-bi-pm_root... -> rel_parts=('vinaya', 'file.json') -> len=2
        if len(rel_parts) == 2:
             book_id = file_name.split('_')[0] # Lấy ID sách từ tên file
             return f"{category}/{book_id}"
             
        # Trường hợp 2: File nằm trong folder con (Structure sâu)
        # Ví dụ: vinaya/pli-tv-bi-vb/folder/... -> len > 2
        if len(rel_parts) > 2:
            return f"{category}/{rel_parts[1]}"
            
    return "uncategorized"

def generate_book_tasks(limit: int = 0) -> Dict[str, List[Tuple[str, Path]]]:
    """
    Quét toàn bộ thư mục root và nhóm các task theo Book.
    """
    base_search_dir = DATA_ROOT / "root"
    if not base_search_dir.exists():
        raise FileNotFoundError(f"Data directory missing: {base_search_dir}")

    logger.info(f"Scanning {base_search_dir} and grouping by books...")
    
    book_tasks: Dict[str, List[Tuple[str, Path]]] = {}
    
    count = 0
    skipped_count = 0
    
    for root, dirs, files in os.walk(base_search_dir):
        for file in files:
            if file.endswith(".json") and "_root-" in file:
                sutta_id = file.split("_")[0]
                full_path = Path(root) / file
                
                # Xác định file này thuộc book nào
                try:
                    rel_parts = full_path.relative_to(base_search_dir).parts
                    group_id = _identify_book_group(rel_parts, file)
                except Exception as e:
                    logger.warning(f"⚠️ Skipping file {file}: Identification error - {e}")
                    skipped_count += 1
                    continue
                
                if group_id == "uncategorized":
                    # Debug log cho file không phân loại được (chỉ in 10 file đầu tiên để đỡ rối)
                    if skipped_count < 10:
                        logger.debug(f"⚠️ Uncategorized: {file} (parts: {rel_parts})")
                    skipped_count += 1
                    continue

                if group_id not in book_tasks:
                    book_tasks[group_id] = []
                
                book_tasks[group_id].append((sutta_id, full_path))
                count += 1
                
                if limit > 0 and count >= limit:
                    break
        if limit > 0 and count >= limit:
            break

    # Sort
    for group in book_tasks:
        book_tasks[group].sort(key=lambda x: x[0])

    sorted_books = dict(sorted(book_tasks.items()))
    
    if skipped_count > 0:
        logger.warning(f"⚠️ Skipped {skipped_count} items due to categorization issues.")
        
    logger.info(f"✅ Found {count} suttas across {len(sorted_books)} books.")
    return sorted_books