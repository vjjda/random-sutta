# Path: src/sutta_processor/logic/super_generator.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Set, Optional

from ..shared.app_config import SUPER_TREE_PATH, SUPER_META_DIR
from ..shared.domain_types import SuttaMeta

logger = logging.getLogger("SuttaProcessor.Logic.SuperGen")

def _load_json(path: Path) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"⚠️ Failed to load {path.name}: {e}")
        return None

def _prune_tree(node: Any, allowed_books: Set[str]) -> Any:
    """
    Đệ quy lọc cây:
    - Nếu là chuỗi (Book ID): Giữ lại nếu nằm trong allowed_books.
    - Nếu là Dict/List: Giữ lại nếu có ít nhất 1 con cháu hợp lệ.
    - Loại bỏ cứng key 'dharmapadas'.
    """
    if isinstance(node, str):
        # Đây là leaf (book id), kiểm tra xem có phải sách của mình không
        return node if node in allowed_books else None

    if isinstance(node, list):
        new_list = []
        for item in node:
            pruned_item = _prune_tree(item, allowed_books)
            if pruned_item is not None:
                new_list.append(pruned_item)
        return new_list if new_list else None

    if isinstance(node, dict):
        # [HARD FILTER] Loại bỏ Dharmapadas theo yêu cầu
        if "dharmapadas" in node:
            return None
            
        new_dict = {}
        for key, value in node.items():
            pruned_value = _prune_tree(value, allowed_books)
            if pruned_value is not None:
                new_dict[key] = pruned_value
        return new_dict if new_dict else None

    return None

def _flatten_keys(node: Any, collected_keys: Set[str]):
    """Thu thập tất cả các key (branch và leaf) còn lại trong cây sau khi lọc."""
    if isinstance(node, str):
        collected_keys.add(node)
    elif isinstance(node, list):
        for item in node:
            _flatten_keys(item, collected_keys)
    elif isinstance(node, dict):
        for key, value in node.items():
            collected_keys.add(key)
            _flatten_keys(value, collected_keys)

def _load_super_metadata(valid_keys: Set[str]) -> Dict[str, Any]:
    """Load và filter metadata từ 3 file lớn trong data/json/super."""
    merged_meta = {}
    
    # Danh sách file cần quét
    target_files = ["sutta.json", "vinaya.json", "abhidhamma.json"]
    
    for fname in target_files:
        fpath = SUPER_META_DIR / fname
        if not fpath.exists():
            continue
            
        raw_data = _load_json(fpath)
        if not raw_data or not isinstance(raw_data, list):
            continue
            
        # Duyệt qua mảng metadata gốc
        for item in raw_data:
            uid = item.get("uid")
            if uid in valid_keys:
                # Chỉ lấy các trường cần thiết
                merged_meta[uid] = {
                    "uid": uid,
                    "type": item.get("type", "group"), # Thường là group hoặc branch
                    "acronym": item.get("acronym", ""),
                    "translated_title": item.get("translated_title", ""),
                    "original_title": item.get("original_title", ""),
                    "blurb": item.get("blurb", None)
                }
                
    return merged_meta

def generate_super_book_data(processed_book_ids: List[str]) -> Optional[Dict[str, Any]]:
    """
    Hàm chính để tạo nội dung cho super-book.
    Args:
        processed_book_ids: Danh sách ID các cuốn sách đã được build thành công (ví dụ: ['dn', 'mn', 'dhp'...])
    """
    if not SUPER_TREE_PATH.exists():
        logger.error(f"❌ Super tree not found at {SUPER_TREE_PATH}")
        return None

    logger.info("🌟 Generating Super Book Structure...")

    # 1. Load Tree gốc
    raw_tree = _load_json(SUPER_TREE_PATH)
    if not raw_tree: return None

    # 2. Prune Tree (Chỉ giữ lại cấu trúc chứa sách đã xử lý)
    allowed_set = set(processed_book_ids)
    
    # [HARDCODE FIX] Thêm các sách Vinaya/Abhidhamma nếu tên file output khác tên trong tree
    # Ví dụ: tree dùng 'pli-tv-bi-pm', ta cần đảm bảo ID này có trong allowed_set nếu ta đã build nó
    # Tuy nhiên, BuildManager output file dựa trên group name. 
    # Nếu file là 'vinaya_pli-tv-bi-pm_book.js', ID là 'pli-tv-bi-pm'. 
    # Logic hiện tại của BuildManager đã extract đúng ID (phần sau dấu gạch chéo cuối cùng).
    
    final_structure = _prune_tree(raw_tree, allowed_set)
    
    if not final_structure:
        logger.warning("⚠️ Super Tree is empty after pruning (No matching books found).")
        return None

    # 3. Collect Valid Keys (để lọc metadata)
    valid_keys: Set[str] = set()
    _flatten_keys(final_structure, valid_keys)
    
    # 4. Load & Filter Metadata
    # valid_keys chứa cả các node cha (ví dụ: "sutta", "long", "dn")
    final_meta = _load_super_metadata(valid_keys)

    # 5. Construct Final Object
    return {
        "id": "tipitaka",
        "title": "The Three Baskets of the Buddhist Canon",
        "structure": final_structure,
        "meta": final_meta,
        "content": {} # Empty as requested
    }