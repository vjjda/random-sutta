# Path: src/sutta_processor/finder.py
import logging
import os
from pathlib import Path
from typing import Dict, List, Tuple

from .config import DATA_ROOT

logger = logging.getLogger("SuttaProcessor")

def find_sutta_files(sutta_id: str, root_file_path: Path) -> Dict[str, Path]:
    """Finds component files using the root file path as a reference."""
    files = {'root': root_file_path}
    
    try:
        # Rel path from data/bilara/root, e.g., "mn/mn1_root..."
        rel_path = root_file_path.relative_to(DATA_ROOT / "root")
        collection_part = rel_path.parent 
        
        # Helper to find related files
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

def get_group_name(root_file_path: Path) -> str:
    """
    Determines the book group (e.g., 'mn', 'kn/dhp').
    """
    try:
        base_dir = DATA_ROOT / "root"
        rel = root_file_path.relative_to(base_dir)
        parts = rel.parts
        
        if not parts:
            return "uncategorized"
            
        # KN usually has sub-books
        if parts[0] == 'kn' and len(parts) > 1:
            return f"kn/{parts[1]}"
        
        # Standard Nikayas (mn, dn, sn, an)
        return parts[0]
            
    except ValueError:
        return "uncategorized"

def scan_root_dir(limit: int = 0) -> List[Tuple[str, Path]]:
    """Scans the root directory for all sutta json files."""
    base_search_dir = DATA_ROOT / "root"
    if not base_search_dir.exists():
        raise FileNotFoundError(f"Data directory missing: {base_search_dir}")

    logger.info(f"Scanning {base_search_dir}...")
    tasks = []
    
    for root, dirs, files in os.walk(base_search_dir):
        for file in files:
            if file.endswith(".json") and "_root-" in file:
                sutta_id = file.split("_")[0]
                tasks.append((sutta_id, Path(root) / file))

    tasks.sort(key=lambda x: x[0])
    
    if limit > 0:
        tasks = tasks[:limit]
        
    logger.info(f"Found {len(tasks)} suttas to process.")
    return tasks