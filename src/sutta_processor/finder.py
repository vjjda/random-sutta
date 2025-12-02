# Path: src/sutta_processor/finder.py
import logging
import json
import os
from pathlib import Path
from typing import Dict, List, Tuple, Any

from .config import DATA_ROOT

logger = logging.getLogger("SuttaProcessor")

# [NEW] Danh sách các sách ngoại lệ (không có file tree nhưng cần xử lý)
# Mapping: { book_uid: group_name }
EXTRA_BOOKS = {
    "pli-tv-bi-pm": "vinaya/pli-tv-bi-pm",
    "pli-tv-bu-pm": "vinaya/pli-tv-bu-pm"
}

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

def _identify_book_group_from_tree(tree_file: Path) -> str:
    try:
        base_tree = DATA_ROOT / "tree"
        rel_path = tree_file.relative_to(base_tree)
        parent = rel_path.parent
        book_id = tree_file.name.replace("-tree.json", "")
        return f"{parent}/{book_id}"
    except Exception:
        return "uncategorized"

def _extract_leaves_from_tree(node: Any) -> List[str]:
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

def _build_root_file_index() -> Dict[str, Path]:
    logger.info("⚡ Indexing root files for fast lookup...")
    root_dir = DATA_ROOT / "root"
    index = {}
    if not root_dir.exists():
        return index
    for file_path in root_dir.rglob("*_root-*.json"):
        if file_path.is_file():
            sutta_id = file_path.name.split("_")[0]
            index[sutta_id] = file_path
    logger.info(f"   -> Indexed {len(index)} root files.")
    return index

def generate_book_tasks(limit: int = 0) -> Dict[str, List[Tuple[str, Path]]]:
    tree_dir = DATA_ROOT / "tree"
    if not tree_dir.exists():
        raise FileNotFoundError(f"Tree directory missing: {tree_dir}")

    file_index = _build_root_file_index()
    logger.info(f"🌲 Scanning Tree files in {tree_dir} for canonical ordering...")
    
    book_tasks: Dict[str, List[Tuple[str, Path]]] = {}
    total_suttas = 0
    
    # 1. Quét sách từ Tree chuẩn
    tree_files = sorted(list(tree_dir.rglob("*-tree.json")))
    for tree_file in tree_files:
        if tree_file.name == "super-tree.json":
            continue
        group_id = _identify_book_group_from_tree(tree_file)
        try:
            with open(tree_file, "r", encoding="utf-8") as f:
                tree_data = json.load(f)
            ordered_uids = _extract_leaves_from_tree(tree_data)
            tasks = []
            for uid in ordered_uids:
                if uid in file_index:
                    tasks.append((uid, file_index[uid]))
            if tasks:
                book_tasks[group_id] = tasks
                total_suttas += len(tasks)
        except Exception as e:
            logger.error(f"Error parsing tree {tree_file.name}: {e}")

    # 2. [NEW] Inject Extra Books (Edge Cases)
    for book_id, group_name in EXTRA_BOOKS.items():
        if book_id in file_index:
            # Nếu chưa có trong danh sách (tránh trùng lặp nếu sau này họ thêm tree)
            if group_name not in book_tasks:
                logger.info(f"   ➕ Injecting extra book: {group_name}")
                # Với Patimokkha, UID của bài kinh chính là UID của sách
                book_tasks[group_name] = [(book_id, file_index[book_id])]
                total_suttas += 1

    logger.info(f"✅ Found {total_suttas} ordered suttas across {len(book_tasks)} books.")
    return book_tasks