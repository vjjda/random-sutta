# Path: src/sutta_processor/logic/range_expander.py
import re
import logging
from typing import Dict, Any, Set, Optional, Tuple

logger = logging.getLogger("SuttaProcessor.Logic.RangeExpander")

def _parse_range_uid(uid: str) -> Optional[Tuple[str, int, int]]:
    pattern = re.compile(r"(?<=\D)(\d+)-(\d+)$")
    match = pattern.search(uid)
    
    if match:
        start_str = match.group(1)
        end_str = match.group(2)
        try:
            start = int(start_str)
            end = int(end_str)
            prefix = uid[:match.start()]
            if start < end:
                 return prefix, start, end
        except ValueError:
            pass
    return None

def _find_explicit_child_ids(content: Dict[str, Any], prefix: str, start: int, end: int) -> Set[str]:
    explicit_ids = set()
    potential_ids = {f"{prefix}{i}" for i in range(start, end + 1)}
    for segment_key in content.keys():
        if ":" in segment_key:
            base_uid = segment_key.split(":")[0]
            if base_uid in potential_ids:
                explicit_ids.add(base_uid)
    return explicit_ids

def _generate_smart_acronym(parent_acronym: str, start: int, end: int, current_num: int) -> str:
    """
    Tạo acronym con bằng cách thay thế dải số trong acronym cha.
    Ví dụ: 
    - Parent: "AN 1.1–10", start=1, end=10, current=5 -> "AN 1.5"
    - Parent: "Bi As 1–7", start=1, end=7, current=3 -> "Bi As 3"
    """
    if not parent_acronym:
        return ""

    # Tạo regex động để tìm đúng dải số start-end ở cuối chuỗi
    # Chấp nhận cả dấu gạch ngang (-) và gạch nối dài (–, unicode \u2013)
    # \s* cho phép có hoặc không có khoảng trắng
    # $ neo vào cuối chuỗi
    range_pattern = re.compile(rf"{start}\s*[-–]\s*{end}$")
    
    # Thay thế dải số tìm được bằng số hiện tại
    new_acronym = range_pattern.sub(str(current_num), parent_acronym)
    
    return new_acronym

def generate_range_shortcuts(
    root_uid: str, 
    content: Dict[str, Any], 
    parent_acronym: str = "" # [NEW] Nhận thêm acronym cha
) -> Dict[str, Any]:
    
    result_meta = {}
    
    # 1. Parse Range
    parsed = _parse_range_uid(root_uid)
    if not parsed:
        return {}
        
    prefix, start, end = parsed
    
    if (end - start) > 500:
        logger.warning(f"⚠️ Range too large for {root_uid}. Skipping.")
        return {}

    # 2. Scan Explicit
    explicit_ids = _find_explicit_child_ids(content, prefix, start, end)

    # 3. Generate
    for i in range(start, end + 1):
        child_uid = f"{prefix}{i}"
        if child_uid == root_uid: continue
            
        is_explicit = child_uid in explicit_ids
        
        # [NEW] Logic tạo Acronym thông minh
        smart_acronym = _generate_smart_acronym(parent_acronym, start, end, i)
        
        # Fallback nếu không có parent acronym hoặc regex không khớp
        if not smart_acronym:
            smart_acronym = child_uid.upper().replace('.', ' ')

        # Logic Scroll
        scroll_target = child_uid if is_explicit else root_uid
        is_implicit = not is_explicit

        shortcut_entry = {
            "type": "shortcut",
            "parent_uid": root_uid,
            "acronym": smart_acronym, # Sử dụng acronym đẹp
            "scroll_target": scroll_target,
            "is_implicit": is_implicit
        }
        
        # Với implicit, trỏ scroll_target về cha để đảm bảo mở đúng trang
        if is_implicit:
             shortcut_entry["scroll_target"] = root_uid
        
        result_meta[child_uid] = shortcut_entry

    if result_meta:
        logger.info(f"   ✨ Expanded {root_uid} -> {len(result_meta)} shortcuts ({start}-{end})")

    return result_meta