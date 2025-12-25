# Path: src/sutta_processor/logic/structure/book_data_builder.py
from typing import Dict, Any, List, Tuple, Optional

from ...shared.domain_types import SuttaMeta
from ..tree_utils import (
    extract_nav_sequence, 
    generate_navigation_map, 
    generate_random_pool, 
    generate_depth_navigation
)

from .tree_loader import load_original_tree, simplify_structure
from .meta_service import ensure_meta_entry
from .structure_expansion import expand_structure_with_subleaves

def build_book_data(
    group_name: str, 
    raw_data: Dict[str, Any], 
    names_map: Dict[str, SuttaMeta],
    generated_acc: List[Tuple[str, str, str, str]] = None,
    external_root_nav: Optional[Dict[str, Dict[str, str]]] = None # [NEW]
) -> Dict[str, Any]:
    """
    Xây dựng dữ liệu sách (Staging Phase).
    [UPDATED] Hỗ trợ inject navigation từ bên ngoài cho root book ID.
    """
    
    # 1. Load Tree
    raw_tree = load_original_tree(group_name)
    simple_tree = simplify_structure(raw_tree)

    meta_dict: Dict[str, Any] = {}
    
    # 2. Expand Structure & Build Base Meta
    final_structure = expand_structure_with_subleaves(simple_tree, raw_data, names_map, meta_dict, generated_acc)
    
    # 3. Add Content Meta & Author
    content_dict = {}
    for uid, payload in raw_data.items():
        if not payload: continue
        content_dict[uid] = payload.get("data", {})
        
        if uid not in meta_dict:
            ensure_meta_entry(uid, "leaf", names_map, meta_dict)
            
        author = payload.get("author_uid")
        if uid in meta_dict and author:
            meta_dict[uid]["author_uid"] = author

    # 4. Rich Staging: Calculate Navigation & Pool (Internal)
    nav_sequence = extract_nav_sequence(final_structure, meta_dict)
    reading_nav_map = generate_navigation_map(nav_sequence)
    random_pool = generate_random_pool(nav_sequence)
    
    branch_nav_map = generate_depth_navigation(final_structure, meta_dict)
    
    full_nav_map = {**branch_nav_map, **reading_nav_map}
    
    for uid, nav_entry in full_nav_map.items():
        if uid in meta_dict:
            meta_dict[uid]["nav"] = nav_entry

    # 5. Final Package & External Nav Injection
    book_id = group_name.split("/")[-1]
    book_meta = names_map.get(book_id, {})
    
    # [NEW] Inject External Nav (Prev/Next Book) if available
    if external_root_nav and book_id in external_root_nav:
        ext_nav = external_root_nav[book_id]
        
        # Đảm bảo root meta tồn tại
        if book_id not in meta_dict:
            # Tạo meta cho root book nếu chưa có (thường là type branch)
            ensure_meta_entry(book_id, "branch", names_map, meta_dict)
        
        # Merge Nav
        if "nav" not in meta_dict[book_id]:
            meta_dict[book_id]["nav"] = {}
        
        # Chỉ cập nhật prev/next, giữ nguyên các nav nội bộ (nếu có - dù root thường ko có nav nội bộ)
        meta_dict[book_id]["nav"].update(ext_nav)

    return {
        "id": book_id,
        "title": book_meta.get("translated_title", book_id.upper()),
        "structure": final_structure,
        "meta": meta_dict,
        "content": content_dict,
        "random_pool": random_pool
    }