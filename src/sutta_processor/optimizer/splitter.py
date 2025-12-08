# Path: src/sutta_processor/optimizer/splitter.py
from typing import Dict, Any, List, Tuple, Set
from .tree_utils import collect_all_keys

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
    """
    sub_books_map = {} 
    
    root_content = structure
    if isinstance(structure, dict):
        if book_id in structure:
            root_content = structure[book_id]
        else:
            values = list(structure.values())
            if values: root_content = values[0]

    # Map tra cứu ngược: uid (chính) -> sub_book_id
    uid_to_subbook = {}

    # 1. Quét Structure
    current_order = 0
    
    def _process_node(key, val):
        nonlocal current_order
        if isinstance(key, str) and key.startswith(book_id) and key != book_id:
            if key not in sub_books_map:
                sub_books_map[key] = {
                    "keys": set(),
                    "struct": val,
                    "order": current_order
                }
                current_order += 1
            
            tree_keys = set()
            collect_all_keys(val, tree_keys)
            tree_keys.add(key)
            
            sub_books_map[key]["keys"].update(tree_keys)
            for k in tree_keys:
                uid_to_subbook[k] = key

    if isinstance(root_content, dict):
        for k, v in root_content.items(): _process_node(k, v)
    elif isinstance(root_content, list):
        for item in root_content:
            if isinstance(item, dict):
                for k, v in item.items(): _process_node(k, v)

    # 2. Quét Meta để "vợt" Alias/Orphans
    for uid, info in full_meta.items():
        if uid in uid_to_subbook:
            continue
            
        # [FIX] Kiểm tra cả parent_uid (cũ) VÀ target_uid (mới)
        # Vì Alias trỏ đến Target, và Target đã có trong uid_to_subbook,
        # nên ta có thể suy ra Alias thuộc về sub-book nào.
        ref_key = info.get("parent_uid") or info.get("target_uid")
        
        target_sub = None
        
        if ref_key and ref_key in uid_to_subbook:
            target_sub = uid_to_subbook[ref_key]
            
        # Fallback Prefix
        elif any(uid.startswith(sub) for sub in sub_books_map.keys()):
             # Logic tìm sub dài nhất (để tránh an1 vs an10)
             # Tuy nhiên với AN/SN hiện tại thì startswith là tạm ổn nếu ref_key fail
             pass

        if target_sub:
            sub_books_map[target_sub]["keys"].add(uid)

    # 3. Kết quả
    sorted_sub_ids = sorted(sub_books_map.keys(), key=lambda k: sub_books_map[k]["order"])
    
    final_results = []
    for sub_id in sorted_sub_ids:
        item = sub_books_map[sub_id]
        final_results.append((sub_id, item["keys"], item["struct"]))

    return final_results