# Path: src/sutta_processor/optimizer/tree_utils.py
from typing import Any, Dict, List, Set, Tuple

def collect_all_keys(node: Any, collected: Set[str]) -> None:
    """Thu thập toàn bộ keys (Branch, Leaf...) để Indexing."""
    if isinstance(node, str):
        collected.add(node)
    elif isinstance(node, list):
        for child in node:
            collect_all_keys(child, collected)
    elif isinstance(node, dict):
        for key, val in node.items():
            collected.add(key)
            collect_all_keys(val, collected)

def _get_flattened_children(node: Any, meta_map: Dict[str, Any]) -> List[str]:
    """Helper: Chỉ lấy danh sách Subleaf (String) từ một nhánh con."""
    results = []
    if isinstance(node, str):
        m_type = meta_map.get(node, {}).get("type")
        if m_type in ["subleaf", "leaf"]: # Chấp nhận cả leaf nếu structure lồng nhau
            results.append(node)
    elif isinstance(node, list):
        for item in node:
            results.extend(_get_flattened_children(item, meta_map))
    elif isinstance(node, dict):
        for val in node.values():
            results.extend(_get_flattened_children(val, meta_map))
    return results

def extract_nav_sequence(node: Any, meta_map: Dict[str, Any]) -> List[Tuple[str, List[str]]]:
    """
    Duyệt cây để tạo danh sách tuần tự các NavUnit.
    Output: [(ParentID, [ChildID, ...]), ...]
    """
    sequence = []

    if isinstance(node, str):
        # Node lá đơn lẻ (không phải key của dict) -> Là một Unit độc lập
        m_type = meta_map.get(node, {}).get("type")
        if m_type == "leaf":
            sequence.append((node, []))

    elif isinstance(node, list):
        for item in node:
            sequence.extend(extract_nav_sequence(item, meta_map))

    elif isinstance(node, dict):
        for key, val in node.items():
            # Check type của Key
            m_type = meta_map.get(key, {}).get("type")
            
            if m_type == "leaf":
                # Đây là Container (an1.1-10) -> Lấy children của nó làm Subleaf
                children = _get_flattened_children(val, meta_map)
                sequence.append((key, children))
                # [QUAN TRỌNG] Không đệ quy tiếp vào val nữa (đã xử lý xong ở đây)
            
            else:
                # Đây là Branch (Vagga/Samyutta) -> Đệ quy tiếp để tìm Leaf bên trong
                sequence.extend(extract_nav_sequence(val, meta_map))

    return sequence

def generate_navigation_map(nav_sequence: List[Tuple[str, List[str]]]) -> Dict[str, Dict[str, str]]:
    """
    Tạo map điều hướng 2 lớp (Backbone & Deep Dive).
    """
    nav_map = {}
    total_units = len(nav_sequence)

    for i, (parent, children) in enumerate(nav_sequence):
        # 1. Backbone Links (Dành cho Parent/Container)
        prev_parent = nav_sequence[i-1][0] if i > 0 else None
        next_parent = nav_sequence[i+1][0] if i < total_units - 1 else None
        
        # Luôn set nav cho Parent
        nav_map[parent] = {}
        if prev_parent: nav_map[parent]["prev"] = prev_parent
        if next_parent: nav_map[parent]["next"] = next_parent

        # 2. Deep Dive Links (Dành cho Subleaf)
        if children:
            child_count = len(children)
            for j, child in enumerate(children):
                nav_map[child] = {}
                
                # Logic Prev
                if j == 0:
                    # Con cả -> Về Prev của Parent (Nhảy cóc)
                    if prev_parent: nav_map[child]["prev"] = prev_parent
                else:
                    # Con giữa -> Về anh liền trước
                    nav_map[child]["prev"] = children[j-1]
                
                # Logic Next
                if j == child_count - 1:
                    # Con út -> Sang Next của Parent (Nhảy cóc)
                    if next_parent: nav_map[child]["next"] = next_parent
                else:
                    # Con giữa -> Sang em liền sau
                    nav_map[child]["next"] = children[j+1]

    return nav_map

def generate_random_pool(nav_sequence: List[Tuple[str, List[str]]]) -> List[str]:
    """
    Tạo danh sách phẳng cho Random Pool từ Nav Sequence.
    Nếu Parent có con -> Lấy con.
    Nếu Parent không con -> Lấy Parent.
    """
    pool = []
    for parent, children in nav_sequence:
        if children:
            pool.extend(children)
        else:
            pool.append(parent)
    return pool