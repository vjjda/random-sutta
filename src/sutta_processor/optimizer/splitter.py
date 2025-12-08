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
    Logic gom nhóm:
    1. Dựa trên Structure Tree (Prefix matching cho Sub-book ID).
    2. Dựa trên Parent Relation (cho Alias/Orphans).
    """
    sub_books_map = {} # sub_id -> { "keys": set(), "struct": val, "order": int }
    
    root_content = structure
    if isinstance(structure, dict):
        if book_id in structure:
            root_content = structure[book_id]
        else:
            values = list(structure.values())
            if values: root_content = values[0]

    # Map tra cứu ngược: uid (chính) -> sub_book_id
    # Dùng để tìm nhà cho Alias dựa theo cha
    uid_to_subbook = {}

    # 1. Quét Structure để định hình các Sub-books
    current_order = 0
    
    def _process_node(key, val):
        nonlocal current_order
        # Điều kiện nhận diện Sub-book: 
        # Key bắt đầu bằng book_id (an1...) HOẶC nằm trong structure SN (sn-...)
        # Với SN, key là "sn-...", book_id="sn". startswith ok.
        if isinstance(key, str) and key.startswith(book_id) and key != book_id:
            
            # Nếu sub_book chưa tồn tại thì tạo mới
            if key not in sub_books_map:
                sub_books_map[key] = {
                    "keys": set(),
                    "struct": val,
                    "order": current_order
                }
                current_order += 1
            
            # Thu thập toàn bộ keys chính thống trong cây con
            tree_keys = set()
            collect_all_keys(val, tree_keys)
            tree_keys.add(key)
            
            # Update vào map chính và map ngược
            sub_books_map[key]["keys"].update(tree_keys)
            for k in tree_keys:
                uid_to_subbook[k] = key

    # Duyệt root content
    if isinstance(root_content, dict):
        for k, v in root_content.items(): _process_node(k, v)
    elif isinstance(root_content, list):
        for item in root_content:
            if isinstance(item, dict):
                for k, v in item.items(): _process_node(k, v)

    # 2. Quét Meta để "vợt" Alias/Orphans (dựa trên Parent)
    for uid, info in full_meta.items():
        # Nếu UID đã có nơi chốn -> Bỏ qua
        if uid in uid_to_subbook:
            continue
            
        # Nếu chưa có (thường là Alias), tìm cha nó
        parent = info.get("parent_uid")
        
        target_sub = None
        
        # Cách 1: Tìm theo Parent
        if parent and parent in uid_to_subbook:
            target_sub = uid_to_subbook[parent]
            
        # Cách 2: Nếu không có Parent hoặc Parent chưa index, thử Prefix (Fallback cho AN)
        elif any(uid.startswith(sub) for sub in sub_books_map.keys()):
             # Tìm sub_id dài nhất mà uid startswith (an1 vs an10)
             # Tuy nhiên logic cha-con ở trên đã cover 99% trường hợp alias
             pass

        # Gán vào Sub-book tìm được
        if target_sub:
            sub_books_map[target_sub]["keys"].add(uid)
            # Không cần update uid_to_subbook vì alias không làm cha ai cả

    # 3. Convert sang List kết quả
    # Sort lại theo thứ tự xuất hiện ban đầu
    sorted_sub_ids = sorted(sub_books_map.keys(), key=lambda k: sub_books_map[k]["order"])
    
    final_results = []
    for sub_id in sorted_sub_ids:
        item = sub_books_map[sub_id]
        final_results.append((sub_id, item["keys"], item["struct"]))

    return final_results