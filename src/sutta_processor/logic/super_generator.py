# Path: src/sutta_processor/logic/super_generator.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Set, Optional

# [UPDATED]
from ..shared.app_config import RAW_SUPER_TREE_FILE, RAW_SUPER_META_DIR

logger = logging.getLogger("SuttaProcessor.Logic.SuperGen")

def _load_json(path: Path) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"⚠️ Failed to load {path.name}: {e}")
        return None

def _prune_tree(node: Any, allowed_books: Set[str]) -> Any:
    if isinstance(node, str):
        return node if node in allowed_books else None

    if isinstance(node, list):
        new_list = []
        for item in node:
            pruned_item = _prune_tree(item, allowed_books)
            if pruned_item is not None:
                new_list.append(pruned_item)
        return new_list if new_list else None

    if isinstance(node, dict):
        if "dharmapadas" in node:
            return None
            
        new_dict = {}
        for key, value in node.items():
            pruned_value = _prune_tree(value, allowed_books)
            if pruned_value is not None:
                new_dict[key] = pruned_value
        return new_dict if new_dict else None

    return None

def _flatten_keys(node: Any, collected_keys: Set[str]):
    if isinstance(node, str):
        collected_keys.add(node)
    elif isinstance(node, list):
        for item in node:
            _flatten_keys(item, collected_keys)
    elif isinstance(node, dict):
        for key, value in node.items():
            collected_keys.add(key)
            _flatten_keys(value, collected_keys)

def _load_super_metadata(valid_keys: Set[str]) -> Dict[str, Any]:
    merged_meta = {}
    target_files = ["sutta.json", "vinaya.json", "abhidhamma.json"]
    
    # [UPDATED]
    for fname in target_files:
        fpath = RAW_SUPER_META_DIR / fname
        if not fpath.exists():
            continue
            
        raw_data = _load_json(fpath)
        if not raw_data or not isinstance(raw_data, list):
            continue
            
        for item in raw_data:
            uid = item.get("uid")
            if uid in valid_keys:
                merged_meta[uid] = {
                    "uid": uid,
                    "type": item.get("type", "group"),
                    "acronym": item.get("acronym", ""),
                    "translated_title": item.get("translated_title", ""),
                    "original_title": item.get("original_title", ""),
                    "blurb": item.get("blurb", None)
                }
    return merged_meta

def generate_super_book_data(processed_book_ids: List[str]) -> Optional[Dict[str, Any]]:
    # [UPDATED]
    if not RAW_SUPER_TREE_FILE.exists():
        logger.error(f"❌ Super tree not found at {RAW_SUPER_TREE_FILE}")
        return None

    logger.info("🌟 Generating Super Book Structure...")

    raw_tree = _load_json(RAW_SUPER_TREE_FILE)
    if not raw_tree: return None

    allowed_set = set(processed_book_ids)
    final_structure = _prune_tree(raw_tree, allowed_set)
    
    if not final_structure:
        logger.warning("⚠️ Super Tree is empty after pruning (No matching books found).")
        return None

    valid_keys: Set[str] = set()
    _flatten_keys(final_structure, valid_keys)
    
    final_meta = _load_super_metadata(valid_keys)

    return {
        "id": "tipitaka",
        "title": "The Three Baskets of the Buddhist Canon",
        "structure": final_structure,
        "meta": final_meta,
        "content": {} 
    }