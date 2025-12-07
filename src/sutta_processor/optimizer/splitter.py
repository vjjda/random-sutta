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
    sub_books = []
    
    # 1. Tìm root content chính xác
    # Cấu trúc có thể là: { "an": [...] } hoặc trực tiếp [...] hoặc { "an": {...} }
    root_content = structure
    
    if isinstance(structure, dict):
        if book_id in structure:
            root_content = structure[book_id]
        else:
            # Fallback: Lấy value đầu tiên
            values = list(structure.values())
            if values: root_content = values[0]

    # Helper xử lý node con
    def _process_node(key, val):
        # Chấp nhận key bắt đầu bằng book_id (vd: an1)
        # HOẶC key nằm trong config (vd: sn1) -> thực tế sn1, sn2...
        if isinstance(key, str) and key.startswith(book_id) and key != book_id:
            sub_leaves = []
            flatten_tree_uids(val, full_meta, sub_leaves)
            
            # Chỉ lấy nếu có nội dung bên trong
            if sub_leaves:
                sub_books.append((key, sub_leaves, val))

    # 2. Duyệt cấu trúc
    if isinstance(root_content, dict):
        for k, v in root_content.items():
            _process_node(k, v)
            
    elif isinstance(root_content, list):
        for item in root_content:
            if isinstance(item, dict):
                for k, v in item.items():
                    _process_node(k, v)
            elif isinstance(item, str):
                # Trường hợp item là string (Leaf), không phải sub-book -> Bỏ qua
                pass

    # Sort
    sub_books.sort(key=lambda x: x[0])
    return sub_books