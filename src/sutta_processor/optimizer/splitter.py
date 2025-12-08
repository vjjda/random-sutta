# Path: src/sutta_processor/optimizer/splitter.py
from typing import Dict, Any, List, Tuple, Set
from .tree_utils import collect_all_keys

# [CHANGED] Dùng Set cho rõ ràng, vì value cũ không dùng đến
SPLIT_BOOKS = {"an", "sn"}

def is_split_book(book_id: str) -> bool:
    return book_id in SPLIT_BOOKS

def extract_sub_books(
    book_id: str, 
    structure: Any, 
    full_meta: Dict[str, Any]
) -> List[Tuple[str, Set[str], Any]]:
    """
    Tách sách mẹ thành các sách con.
    Giữ nguyên thứ tự gốc từ structure.
    """
    sub_books = []
    
    root_content = structure
    if isinstance(structure, dict):
        if book_id in structure:
            root_content = structure[book_id]
        else:
            values = list(structure.values())
            if values: root_content = values[0]

    temp_map = {}
    ordered_sub_ids = []

    def _process_node(key, val):
        if isinstance(key, str) and key.startswith(book_id) and key != book_id:
            if key not in temp_map:
                ordered_sub_ids.append(key)
                
            tree_keys = set()
            collect_all_keys(val, tree_keys)
            tree_keys.add(key)
            
            if key in temp_map:
                existing_keys, existing_val = temp_map[key]
                existing_keys.update(tree_keys)
            else:
                temp_map[key] = (tree_keys, val)

    if isinstance(root_content, dict):
        for k, v in root_content.items(): _process_node(k, v)
    elif isinstance(root_content, list):
        for item in root_content:
            if isinstance(item, dict):
                for k, v in item.items(): _process_node(k, v)

    final_results = []
    
    for sub_id in ordered_sub_ids:
        tree_keys, sub_val = temp_map[sub_id]
        
        extended_keys = tree_keys.copy()
        for meta_key in full_meta.keys():
            if meta_key in extended_keys: continue
            if meta_key.startswith(sub_id):
                extended_keys.add(meta_key)
        
        final_results.append((sub_id, extended_keys, sub_val))

    return final_results