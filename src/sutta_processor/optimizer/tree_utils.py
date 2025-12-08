# Path: src/sutta_processor/optimizer/tree_utils.py
from typing import Any, Dict, List, Set, Tuple

def collect_all_keys(node: Any, collected: Set[str]) -> None:
    """Thu thập toàn bộ keys."""
    if isinstance(node, str):
        collected.add(node)
    elif isinstance(node, list):
        for child in node:
            collect_all_keys(child, collected)
    elif isinstance(node, dict):
        for key, val in node.items():
            collected.add(key)
            collect_all_keys(val, collected)

def flatten_tree_uids(node: Any, meta_map: Dict[str, Any], result_list: List[str]) -> None:
    """Làm phẳng cây (chỉ lấy leaf/subleaf)."""
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

def _get_flattened_children(node: Any, meta_map: Dict[str, Any]) -> List[str]:
    results = []
    if isinstance(node, str):
        m_type = meta_map.get(node, {}).get("type")
        if m_type in ["subleaf", "leaf"]:
            results.append(node)
    elif isinstance(node, list):
        for item in node:
            results.extend(_get_flattened_children(item, meta_map))
    elif isinstance(node, dict):
        for val in node.values():
            results.extend(_get_flattened_children(val, meta_map))
    return results

def extract_nav_sequence(node: Any, meta_map: Dict[str, Any]) -> List[Tuple[str, List[str]]]:
    """Trích xuất trình tự đọc: [(Parent, [Children]), ...]"""
    sequence = []
    if isinstance(node, str):
        m_type = meta_map.get(node, {}).get("type")
        if m_type == "leaf":
            sequence.append((node, []))
    elif isinstance(node, list):
        for item in node:
            sequence.extend(extract_nav_sequence(item, meta_map))
    elif isinstance(node, dict):
        for key, val in node.items():
            m_type = meta_map.get(key, {}).get("type")
            if m_type == "leaf":
                children = _get_flattened_children(val, meta_map)
                sequence.append((key, children))
            else:
                sequence.extend(extract_nav_sequence(val, meta_map))
    return sequence

def generate_navigation_map(nav_sequence: List[Tuple[str, List[str]]]) -> Dict[str, Dict[str, str]]:
    """Tạo Nav Map cho nội dung bài đọc (Leaf/Subleaf)."""
    nav_map = {}
    total_units = len(nav_sequence)

    for i, (parent, children) in enumerate(nav_sequence):
        prev_parent = nav_sequence[i-1][0] if i > 0 else None
        next_parent = nav_sequence[i+1][0] if i < total_units - 1 else None
        
        nav_map[parent] = {}
        if prev_parent: nav_map[parent]["prev"] = prev_parent
        if next_parent: nav_map[parent]["next"] = next_parent

        if children:
            child_count = len(children)
            for j, child in enumerate(children):
                nav_map[child] = {}
                if j == 0:
                    if prev_parent: nav_map[child]["prev"] = prev_parent
                else:
                    nav_map[child]["prev"] = children[j-1]
                
                if j == child_count - 1:
                    if next_parent: nav_map[child]["next"] = next_parent
                else:
                    nav_map[child]["next"] = children[j+1]
    return nav_map

def generate_random_pool(nav_sequence: List[Tuple[str, List[str]]]) -> List[str]:
    pool = []
    for parent, children in nav_sequence:
        if children: pool.extend(children)
        else: pool.append(parent)
    return pool

def build_nav_map(linear_uids: List[str]) -> Dict[str, Dict[str, str]]:
    # Legacy wrapper if needed, but generate_navigation_map is better
    nav_map = {}
    total = len(linear_uids)
    for i, uid in enumerate(linear_uids):
        nav_entry = {}
        if i > 0: nav_entry["prev"] = linear_uids[i-1]
        if i < total - 1: nav_entry["next"] = linear_uids[i+1]
        if nav_entry: nav_map[uid] = nav_entry
    return nav_map

def generate_depth_navigation(structure: Any, meta_map: Dict[str, Any]) -> Dict[str, Dict[str, str]]:
    """
    [NEW] Tạo navigation cho Branch dựa trên Depth Level.
    """
    flat_nodes: List[Tuple[str, int]] = []

    def traverse(node: Any, current_depth: int):
        if isinstance(node, str):
            m_type = meta_map.get(node, {}).get("type")
            if m_type not in ["leaf", "subleaf", "alias"]:
                flat_nodes.append((node, current_depth))
        elif isinstance(node, list):
            for item in node:
                traverse(item, current_depth)
        elif isinstance(node, dict):
            for key, val in node.items():
                m_type = meta_map.get(key, {}).get("type")
                if m_type not in ["leaf", "subleaf", "alias"]:
                    flat_nodes.append((key, current_depth))
                traverse(val, current_depth + 1)

    traverse(structure, 0)

    depth_groups: Dict[int, List[str]] = {}
    for uid, depth in flat_nodes:
        if depth not in depth_groups: depth_groups[depth] = []
        depth_groups[depth].append(uid)

    branch_nav_map = {}
    for depth, uids in depth_groups.items():
        total = len(uids)
        for i, uid in enumerate(uids):
            nav_entry = {}
            if i > 0: nav_entry["prev"] = uids[i-1]
            if i < total - 1: nav_entry["next"] = uids[i+1]
            if nav_entry: branch_nav_map[uid] = nav_entry

    return branch_nav_map