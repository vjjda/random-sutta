# Path: src/sutta_processor/optimizer/splitter.py
from typing import Dict, Any, List, Tuple, Set
from .tree_utils import flatten_tree_uids

SPLIT_CONFIG = {
    "an": "nipata",
    "sn": "vagga"
}

def is_split_book(book_id: str) -> bool:
    return book_id in SPLIT_CONFIG

def collect_all_keys(node: Any, collected: Set[str]) -> None:
    """Thu thập TẤT CẢ key (Branch + Leaf) trong cây."""
    if isinstance(node, str):
        collected.add(node)
    elif isinstance(node, list):
        for child in node:
            collect_all_keys(child, collected)
    elif isinstance(node, dict):
        for key, val in node.items():
            collected.add(key) # Lấy Branch Key
            collect_all_keys(val, collected)

def extract_sub_books(
    book_id: str, 
    structure: Any, 
    full_meta: Dict[str, Any]
) -> List[Tuple[str, List[str], Any]]: # Return thêm structure con
    """
    Tách sách mẹ thành các sách con.
    Trả về: [(sub_id, leaf_uids, sub_structure), ...]
    """
    sub_books = []
    
    root_content = structure
    if isinstance(structure, dict):
        if book_id in structure:
            root_content = structure[book_id]
        else:
            values = list(structure.values())
            if values: root_content = values[0]

    def _process_node(key, val):
        if isinstance(key, str) and key.startswith(book_id) and key != book_id:
            # 1. Lấy danh sách Leaf để tính Nav/Count
            sub_leaves = []
            flatten_tree_uids(val, full_meta, sub_leaves)
            
            if sub_leaves:
                # Trả về cả cấu trúc con để Worker quét lấy Meta Branch
                sub_books.append((key, sub_leaves, val))

    if isinstance(root_content, dict):
        for k, v in root_content.items():
            _process_node(k, v)
    elif isinstance(root_content, list):
        for item in root_content:
            if isinstance(item, dict):
                for k, v in item.items():
                    _process_node(k, v)

    sub_books.sort(key=lambda x: x[0])
    return sub_books