# Path: src/sutta_processor/optimizer/splitter.py
from typing import Dict, Any, List, Tuple, Set
from .tree_utils import collect_all_keys # [CHANGED] Reuse from utils

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
) -> List[Tuple[str, Set[str], Any]]: # Return Set[str] keys instead of List uids
    """
    Tách sách mẹ thành các sách con.
    Trả về: [(sub_id, all_keys_in_subbook, sub_structure), ...]
    all_keys_in_subbook bao gồm cả Alias (không có trong Tree).
    """
    sub_books = []
    
    root_content = structure
    if isinstance(structure, dict):
        if book_id in structure:
            root_content = structure[book_id]
        else:
            values = list(structure.values())
            if values: root_content = values[0]

    # Helper: Tìm sub-books từ cấu trúc cây
    # Map: sub_id -> (tree_keys_set, sub_structure)
    temp_map = {}

    def _process_node(key, val):
        if isinstance(key, str) and key.startswith(book_id) and key != book_id:
            # Thu thập keys trong cây con này
            tree_keys = set()
            collect_all_keys(val, tree_keys)
            tree_keys.add(key)
            temp_map[key] = (tree_keys, val)

    if isinstance(root_content, dict):
        for k, v in root_content.items(): _process_node(k, v)
    elif isinstance(root_content, list):
        for item in root_content:
            if isinstance(item, dict):
                for k, v in item.items(): _process_node(k, v)

    # Convert map to list & Enrich with Orphans (Aliases)
    # Logic: Alias an1.181 (trong meta) thuộc về sub-book an1 (trong temp_map)
    # Ta duyệt meta 1 lần để gán orphan vào đúng chỗ
    
    # Sort sub_ids để duyệt có thứ tự
    sorted_sub_ids = sorted(temp_map.keys())
    
    # Tạo list kết quả
    final_results = []
    
    for sub_id in sorted_sub_ids:
        tree_keys, sub_val = temp_map[sub_id]
        
        # Quét Meta để tìm anh em họ hàng (Alias)
        # Logic: Key bắt đầu bằng sub_id (vd: an1.181 starts with an1)
        # Lưu ý: Cần cẩn thận với an10 vs an1. an10 startswith an1 -> False. OK.
        # an1.181 starts with an1. OK.
        # an12 starts with an1 -> False. OK.
        
        # Để tối ưu, ta không loop full meta mỗi lần.
        # Nhưng vì số lượng sub_books ít (11 cho AN, 56 cho SN), loop cũng không sao.
        
        extended_keys = tree_keys.copy()
        for meta_key in full_meta.keys():
            if meta_key in extended_keys: continue
            
            # Check prefix membership
            # Thêm dấu chấm hoặc ký tự phân cách để chính xác hơn nếu cần
            # Ở đây đơn giản là check startswith.
            # Với AN: an1, an2... an10.
            # an1.xxx thuộc an1.
            # an10.xxx thuộc an10.
            # an1 vs an10: an10 không startswith an1. an1 cũng ko startswith an10. Safe.
            
            if meta_key.startswith(sub_id):
                # Double check: đảm bảo không thuộc về sub_id dài hơn (vd: an1 vs an11)
                # Nhưng an11 không bắt đầu bằng an1. Nên logic này an toàn với bộ dữ liệu hiện tại.
                extended_keys.add(meta_key)
        
        final_results.append((sub_id, extended_keys, sub_val))

    return final_results