# Path: src/sutta_processor/optimizer/tree_utils.py
from typing import Any, Dict, List, Set

def flatten_tree_uids(node: Any, meta_map: Dict[str, Any], result_list: List[str]) -> None:
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
    nav_map = {}
    total = len(linear_uids)
    for i, uid in enumerate(linear_uids):
        nav_entry = {}
        if i > 0: nav_entry["prev"] = linear_uids[i-1]
        if i < total - 1: nav_entry["next"] = linear_uids[i+1]
        if nav_entry: nav_map[uid] = nav_entry
    return nav_map

def prune_tree_aliases(node: Any, meta_map: Dict[str, Any]) -> Any:
    """
    Loại bỏ các node Alias khỏi cây cấu trúc.
    Dùng để làm sạch Tree trước khi gửi xuống Frontend.
    """
    if isinstance(node, str):
        # Kiểm tra type trong meta, nếu là alias thì loại bỏ (trả về None)
        m_type = meta_map.get(node, {}).get("type")
        return None if m_type == "alias" else node

    elif isinstance(node, list):
        new_list = []
        for child in node:
            pruned_child = prune_tree_aliases(child, meta_map)
            if pruned_child is not None:
                new_list.append(pruned_child)
        # Nếu list rỗng sau khi lọc, vẫn trả về list rỗng để giữ cấu trúc
        return new_list

    elif isinstance(node, dict):
        new_dict = {}
        for k, v in node.items():
            pruned_val = prune_tree_aliases(v, meta_map)
            # Giữ key chỉ khi value không None (nhưng value rỗng [] vẫn giữ)
            if pruned_val is not None:
                new_dict[k] = pruned_val
        return new_dict if new_dict else None

    return node