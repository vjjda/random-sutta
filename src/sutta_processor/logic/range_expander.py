# Path: src/sutta_processor/logic/range_expander.py
import re
import logging
from typing import Dict, Any, Set, Optional, Tuple, List

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
    """Tìm các ID thực sự sở hữu segment trong content."""
    explicit_ids = set()
    potential_ids = {f"{prefix}{i}" for i in range(start, end + 1)}
    
    for segment_key in content.keys():
        # Segment key format: uid:segment_id (vd: an1.1:1.1)
        if ":" in segment_key:
            base_uid = segment_key.split(":")[0]
            if base_uid in potential_ids:
                explicit_ids.add(base_uid)
    return explicit_ids

def _generate_smart_acronym(parent_acronym: str, start: int, end: int, current_num: int) -> str:
    if not parent_acronym:
        return ""
    # Tìm chuỗi số range ở cuối (vd: 1-10) để thay thế
    range_pattern = re.compile(rf"{start}\s*[-–]\s*{end}$")
    new_acronym = range_pattern.sub(str(current_num), parent_acronym)
    return new_acronym

def generate_subleaf_shortcuts(
    root_uid: str, 
    content: Dict[str, Any], 
    parent_acronym: str = ""
) -> Tuple[List[str], Dict[str, Any]]:
    """
    Trả về:
    1. List[str]: Danh sách ID subleaf (để đưa vào structure).
    2. Dict[str, Any]: Metadata cho cả subleaf và alias.
    """
    result_meta = {}
    ordered_ids = []
    
    # 1. Parse Range
    parsed = _parse_range_uid(root_uid)
    if not parsed:
        # Không phải range -> Trả về chính nó
        return [root_uid], {}
        
    prefix, start, end = parsed
    
    if (end - start) > 500:
        logger.warning(f"⚠️ Range too large for {root_uid}. Skipping expansion.")
        return [root_uid], {}

    # 2. Scan Explicit (Những ID thực sự có nội dung)
    explicit_ids = _find_explicit_child_ids(content, prefix, start, end)

    # 3. Generate
    for i in range(start, end + 1):
        child_uid = f"{prefix}{i}"
        
        # [QUAN TRỌNG] Phân loại Subleaf vs Alias
        if child_uid in explicit_ids:
            # Case 1: SUBLEAF (Có content)
            ordered_ids.append(child_uid) # Add vào danh sách Structure
            entry_type = "subleaf"
            extract_id = child_uid # Key để frontend extract content
        else:
            # Case 2: ALIAS (Không có content riêng)
            # Không add vào ordered_ids -> Không hiện trên Nav
            entry_type = "alias"
            extract_id = None 

        # Tạo Acronym
        smart_acronym = _generate_smart_acronym(parent_acronym, start, end, i)
        if not smart_acronym:
            smart_acronym = child_uid.upper().replace('.', ' ')

        meta_entry = {
            "type": entry_type,
            "parent_uid": root_uid,
            "acronym": smart_acronym,
            "extract_id": extract_id, # Field mới
            "is_implicit": (entry_type == "alias")
        }
        
        # Nếu là alias, vẫn giữ extract_id trỏ về root nếu muốn support link tới parent?
        # Nhưng theo thiết kế "Alias chỉ là tên gọi", ta để extract_id = None để FE biết mà xử lý fallback.
        
        result_meta[child_uid] = meta_entry

    if result_meta:
        logger.info(f"   ✨ Expanded {root_uid} -> {len(ordered_ids)} subleaves (Total {len(result_meta)} generated)")

    return ordered_ids, result_meta