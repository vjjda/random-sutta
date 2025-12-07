# Path: src/sutta_processor/optimizer/splitter.py
from typing import Dict, Any, List, Tuple
from .tree_utils import flatten_tree_uids

# Danh sách sách cần tách nhỏ (Hardcode logic)
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
) -> List[Tuple[str, List[str]]]:
    """
    Tách sách mẹ thành các sách con dựa trên cấu trúc cấp 1.
    Trả về: [('an1', [uids...]), ('an2', [uids...])]
    """
    sub_books = []
    
    # 1. Định vị root content của sách
    root_content = structure
    if isinstance(structure, dict):
        if book_id in structure:
            root_content = structure[book_id]
        else:
            # Fallback an toàn: Lấy value đầu tiên nếu là dict
            values = list(structure.values())
            if values: root_content = values[0]

    # Helper xử lý từng node con
    def _process_node(key, val):
        # Logic: Sách con phải bắt đầu bằng ID sách mẹ (vd: an1 bắt đầu bằng an)
        if isinstance(key, str) and key.startswith(book_id) and key != book_id:
            sub_uids = []
            flatten_tree_uids(val, full_meta, sub_uids)
            if sub_uids:
                sub_books.append((key, sub_uids))

    # 2. Duyệt cấu trúc (Hỗ trợ cả Dict và List of Dicts)
    if isinstance(root_content, dict):
        for k, v in root_content.items():
            _process_node(k, v)
            
    elif isinstance(root_content, list):
        for item in root_content:
            if isinstance(item, dict):
                for k, v in item.items():
                    _process_node(k, v)

    # Sort theo ID (an1 -> an2)
    sub_books.sort(key=lambda x: x[0])
    return sub_books