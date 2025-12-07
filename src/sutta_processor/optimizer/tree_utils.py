# Path: src/sutta_processor/optimizer/tree_utils.py
from typing import Any, Dict, List, Set

def flatten_tree_uids(node: Any, meta_map: Dict[str, Any], result_list: List[str]) -> None:
    """
    Làm phẳng cây để lấy danh sách thứ tự đọc (Linear Reading Order).
    Chỉ lấy các node có nội dung đọc được (Leaf/Subleaf).
    """
    if isinstance(node, str):
        m_type = meta_map.get(node, {}).get("type")
        if m_type in ["leaf", "subleaf"]:
            result_list.append(node)
    elif isinstance(node, list):
        for child in node:
            flatten_tree_uids(child, meta_map, result_list)
    elif isinstance(node, dict):
        for value in node.values():
            flatten_tree_uids(value, meta_map, result_list)

def collect_all_keys(node: Any, collected: Set[str]) -> None:
    """
    Thu thập TẤT CẢ các keys (Branch, Leaf, Container) trong một cấu trúc cây.
    Dùng để đảm bảo không bỏ sót metadata của các mục lục.
    """
    if isinstance(node, str):
        collected.add(node)
    elif isinstance(node, list):
        for child in node:
            collect_all_keys(child, collected)
    elif isinstance(node, dict):
        for key, val in node.items():
            collected.add(key)
            collect_all_keys(val, collected)

def build_nav_map(linear_uids: List[str]) -> Dict[str, Dict[str, str]]:
    """Tính toán liên kết Prev/Next."""
    nav_map = {}
    total = len(linear_uids)
    for i, uid in enumerate(linear_uids):
        nav_entry = {}
        if i > 0: 
            nav_entry["prev"] = linear_uids[i-1]
        if i < total - 1: 
            nav_entry["next"] = linear_uids[i+1]
        
        if nav_entry: 
            nav_map[uid] = nav_entry
    return nav_map