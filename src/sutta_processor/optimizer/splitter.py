# Path: src/sutta_processor/optimizer/splitter.py
from typing import Dict, Any, List, Tuple
from .tree_utils import flatten_tree_uids

SPLIT_CONFIG = {
    "an": "nipata",
    "sn": "vagga"
}

def is_split_book(book_id: str) -> bool:
    return book_id in SPLIT_CONFIG

def extract_sub_books(
    book_id: str, 
    structure: Any, 
    full_meta: Dict[str, Any]
) -> List[Tuple[str, List[str], Any]]:
    """
    Tách sách mẹ thành các sách con.
    Trả về: [(sub_id, leaf_uids, sub_structure), ...]
    """
    sub_books = []
    
    # Tìm root content trong structure
    root_content = structure
    if isinstance(structure, dict):
        if book_id in structure:
            root_content = structure[book_id]
        else:
            # Fallback
            values = list(structure.values())
            if values: root_content = values[0]

    def _process_node(key, val):
        # Logic: Sách con là các key cấp 1 bắt đầu bằng id mẹ (vd: an1)
        if isinstance(key, str) and key.startswith(book_id) and key != book_id:
            sub_leaves = []
            flatten_tree_uids(val, full_meta, sub_leaves)
            
            # Chỉ lấy nếu có nội dung bên trong
            if sub_leaves:
                sub_books.append((key, sub_leaves, val))

    # Duyệt cấu trúc
    if isinstance(root_content, dict):
        for k, v in root_content.items():
            _process_node(k, v)
    elif isinstance(root_content, list):
        for item in root_content:
            if isinstance(item, dict):
                for k, v in item.items():
                    _process_node(k, v)

    # Sort theo ID (an1 -> an2...)
    sub_books.sort(key=lambda x: x[0])
    return sub_books