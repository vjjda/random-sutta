# Path: src/sutta_processor/ingestion/file_crawler.py
import logging
import json
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

# Import từ Shared Layer
from ..shared.app_config import DATA_ROOT

logger = logging.getLogger("SuttaProcessor.Ingestion.Crawler")

EXTRA_BOOKS = {
    "pli-tv-bi-pm": "vinaya/pli-tv-bi-pm",
    "pli-tv-bu-pm": "vinaya/pli-tv-bu-pm"
}

def _build_root_file_index() -> Dict[str, Path]:
    logger.info("⚡ Indexing root files...")
    root_dir = DATA_ROOT / "root"
    index = {}
    if not root_dir.exists(): return index
    for file_path in root_dir.rglob("*_root-*.json"):
        if file_path.is_file():
            sutta_id = file_path.name.split("_")[0]
            index[sutta_id] = file_path
    return index

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
    if isinstance(node, str): return [node]
    elif isinstance(node, list):
        for child in node: leaves.extend(_extract_leaves_from_tree(child))
    elif isinstance(node, dict):
        for key, children in node.items(): leaves.extend(_extract_leaves_from_tree(children))
    return leaves

def generate_book_tasks(meta_map: Dict[str, Any]) -> Dict[str, List[Tuple[str, Path, Optional[str]]]]:
    tree_dir = DATA_ROOT / "tree"
    if not tree_dir.exists():
        logger.warning(f"Tree directory missing: {tree_dir}")
        return {}

    file_index = _build_root_file_index()
    logger.info(f"🌲 Scanning Tree files...")
    
    book_tasks = {}
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
                book_tasks[group_id] = tasks
                total_suttas += len(tasks)
        except Exception as e:
            logger.error(f"Error parsing tree {tree_file.name}: {e}")

    # Inject Extra Books
    for book_id, group_name in EXTRA_BOOKS.items():
        if book_id in file_index and group_name not in book_tasks:
            logger.info(f"   ➕ Injecting extra book: {group_name}")
            root_path = file_index[book_id]
            author_uid = meta_map.get(book_id, {}).get("best_author_uid")
            book_tasks[group_name] = [(book_id, root_path, author_uid)]
            total_suttas += 1

    logger.info(f"✅ Generated tasks for {total_suttas} suttas.")
    return book_tasks