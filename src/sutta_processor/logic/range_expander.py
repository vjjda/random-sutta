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
        if ":" in segment_key:
            base_uid = segment_key.split(":")[0]
            if base_uid in potential_ids:
                explicit_ids.add(base_uid)
    return explicit_ids

def _generate_smart_acronym(parent_acronym: str, start: int, end: int, current_num: int) -> str:
    if not parent_acronym:
        return ""
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
    
    parsed = _parse_range_uid(root_uid)
    if not parsed:
        return [root_uid], {}
        
    prefix, start, end = parsed
    
    if (end - start) > 500:
        logger.warning(f"⚠️ Range too large for {root_uid}. Skipping expansion.")
        return [root_uid], {}

    explicit_ids = _find_explicit_child_ids(content, prefix, start, end)

    for i in range(start, end + 1):
        child_uid = f"{prefix}{i}"
        
        # Determine Type
        if child_uid in explicit_ids:
            # SUBLEAF: Có content -> Add vào structure
            ordered_ids.append(child_uid)
            entry_type = "subleaf"
            extract_id = child_uid
        else:
            # ALIAS: Không content -> Chỉ Meta
            entry_type = "alias"
            extract_id = None

        smart_acronym = _generate_smart_acronym(parent_acronym, start, end, i)
        if not smart_acronym:
            smart_acronym = child_uid.upper().replace('.', ' ')

        # [UPDATED] Clean Meta Construction
        meta_entry = {
            "type": entry_type,
            "parent_uid": root_uid,
            "acronym": smart_acronym,
            "is_implicit": (entry_type == "alias")
        }
        
        # Chỉ thêm key extract_id nếu nó tồn tại (tức là subleaf)
        if extract_id:
            meta_entry["extract_id"] = extract_id
        
        result_meta[child_uid] = meta_entry

    if result_meta:
        logger.info(f"   ✨ Expanded {root_uid} -> {len(ordered_ids)} subleaves")

    return ordered_ids, result_meta