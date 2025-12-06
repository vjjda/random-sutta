# Path: src/sutta_processor/ingestion/file_crawler.py
import logging
import json
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

# [UPDATED]
from ..shared.app_config import RAW_BILARA_DIR, RAW_BILARA_TEXT_DIR

logger = logging.getLogger("SuttaProcessor.Ingestion.Crawler")

EXTRA_BOOKS = {
    "pli-tv-bi-pm": "vinaya/pli-tv-bi-pm",
    "pli-tv-bu-pm": "vinaya/pli-tv-bu-pm"
}

def _build_root_file_index() -> Dict[str, Path]:
    logger.info("⚡ Indexing root files...")
    # [UPDATED]
    root_dir = RAW_BILARA_TEXT_DIR
    index = {}
    if not root_dir.exists(): return index
    for file_path in root_dir.rglob("*_root-*.json"):
        if file_path.is_file():
            sutta_id = file_path.name.split("_")[0]
            index[sutta_id] = file_path
    return index

def _identify_book_group_from_tree(tree_file: Path) -> str:
    try:
        # [UPDATED]
        base_tree = RAW_BILARA_DIR / "tree"
        rel_path = tree_file.relative_to(base_tree)
        parent = rel_path.parent
        book_id = tree_file.name.replace("-tree.json", "")
        return f"{parent}/{book_id}"
    except Exception:
        return "uncategorized"

def _extract_leaves_from_tree(node: Any) -> List[str]:
    leaves = []
    if isinstance(node, str): return [node]
    elif isinstance(node, list):
        for child in node: leaves.extend(_extract_leaves_from_tree(child))
    elif isinstance(node, dict):
        for key, children in node.items(): leaves.extend(_extract_leaves_from_tree(children))
    return leaves

def _get_priority_score(group_name: str) -> int:
    if group_name.startswith("sutta"): return 0
    if group_name.startswith("vinaya"): return 1
    if group_name.startswith("abhidhamma"): return 2
    return 3

def generate_book_tasks(meta_map: Dict[str, Any]) -> Dict[str, List[Tuple[str, Path, Optional[str]]]]:
    # [UPDATED]
    tree_dir = RAW_BILARA_DIR / "tree"
    if not tree_dir.exists():
        logger.warning(f"Tree directory missing: {tree_dir}")
        return {}

    file_index = _build_root_file_index()
    logger.info(f"🌲 Scanning Tree files...")
    
    raw_tasks_list: List[Tuple[str, List[Tuple[str, Path, Optional[str]]]]] = []
    total_suttas = 0
    
    tree_files = sorted(list(tree_dir.rglob("*-tree.json")))
    
    for tree_file in tree_files:
        if tree_file.name == "super-tree.json": continue
        group_id = _identify_book_group_from_tree(tree_file)
        
        try:
            with open(tree_file, "r", encoding="utf-8") as f:
                tree_data = json.load(f)
            ordered_uids = _extract_leaves_from_tree(tree_data)
            
            tasks = []
            for uid in ordered_uids:
                if uid in file_index:
                    root_path = file_index[uid]
                    author_uid = None
                    if uid in meta_map:
                        author_uid = meta_map[uid].get("best_author_uid")
                    tasks.append((uid, root_path, author_uid))
            
            if tasks:
                raw_tasks_list.append((group_id, tasks))
                total_suttas += len(tasks)
        except Exception as e:
            logger.error(f"Error parsing tree {tree_file.name}: {e}")

    for book_id, group_name in EXTRA_BOOKS.items():
        if book_id in file_index:
            logger.info(f"   ➕ Injecting extra book: {group_name}")
            root_path = file_index[book_id]
            author_uid = meta_map.get(book_id, {}).get("best_author_uid")
            
            tasks = [(book_id, root_path, author_uid)]
            raw_tasks_list.append((group_name, tasks))
            total_suttas += 1

    raw_tasks_list.sort(key=lambda x: _get_priority_score(x[0]))
    book_tasks = {k: v for k, v in raw_tasks_list}

    logger.info(f"✅ Generated tasks for {total_suttas} suttas (Sorted by Priority).")
    return book_tasks