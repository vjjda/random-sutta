# Path: src/sutta_processor/logic/range_expander.py
import re
import logging
from typing import Dict, Any, List, Tuple, Set, Optional

logger = logging.getLogger("SuttaProcessor.Logic.RangeExpander")

def _natural_keys(text: str) -> List[Any]:
    return [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', text)]

def _parse_range_string(uid: str) -> Optional[Tuple[str, int, int]]:
    """Parse 'an1.281-283' -> ('an1.', 281, 283)."""
    pattern = re.compile(r"^(.*?)(\d+)[-–](\d+)$")
    match = pattern.match(uid)
    if match:
        prefix = match.group(1)
        start_str = match.group(2)
        end_str = match.group(3)
        try:
            start = int(start_str)
            end = int(end_str)
            if start < end:
                return prefix, start, end
        except ValueError:
            pass
    return None

def _expand_alias_ids(prefix: str, start: int, end: int) -> List[str]:
    if (end - start) > 500: return []
    return [f"{prefix}{i}" for i in range(start, end + 1)]

def _generate_smart_acronym(parent_acronym: str, start: int, end: int, current_num: int) -> str:
    if not parent_acronym: return ""
    range_pattern = re.compile(rf"{start}\s*[-–]\s*{end}")
    new_acronym = range_pattern.sub(str(current_num), parent_acronym)
    if new_acronym == parent_acronym: return "" 
    return new_acronym

def generate_subleaf_shortcuts(
    root_uid: str, 
    content: Dict[str, Any], 
    parent_acronym: str = ""
) -> Tuple[List[str], Dict[str, Any]]:
    
    result_meta = {}
    ordered_structure_ids = []

    # 1. Quét Content tìm Subleaves
    real_prefixes = set()
    for seg_id in content.keys():
        if ":" in seg_id:
            prefix = seg_id.split(":")[0]
            real_prefixes.add(prefix)

    sorted_prefixes = sorted(list(real_prefixes), key=_natural_keys)
    root_range_info = _parse_range_string(root_uid)

    # CASE A: Single Leaf
    is_single_leaf = (len(sorted_prefixes) == 0) or \
                     (len(sorted_prefixes) == 1 and sorted_prefixes[0] == root_uid)

    if is_single_leaf:
        if root_range_info:
            prefix, start, end = root_range_info
            aliases = _expand_alias_ids(prefix, start, end)
            for alias_id in aliases:
                if alias_id == root_uid: continue
                try:
                    num_part = alias_id[len(prefix):]
                    current_num = int(num_part)
                    alias_acronym = _generate_smart_acronym(parent_acronym, start, end, current_num)
                except ValueError:
                    alias_acronym = ""

                result_meta[alias_id] = {
                    "type": "alias",
                    "parent_uid": root_uid,
                    "extract_id": None, 
                    "acronym": alias_acronym
                }
        return [root_uid], result_meta

    # CASE B: Container Leaf (Có Subleaves)
    else:
        for sub_uid in sorted_prefixes:
            ordered_structure_ids.append(sub_uid)
            
            # 1. Subleaf Meta
            sub_acronym = ""
            if root_range_info:
                root_prefix, r_start, r_end = root_range_info
                if sub_uid.startswith(root_prefix):
                    try:
                        num_part = sub_uid[len(root_prefix):]
                        current_num = int(num_part)
                        sub_acronym = _generate_smart_acronym(parent_acronym, r_start, r_end, current_num)
                    except ValueError:
                        pass
            
            result_meta[sub_uid] = {
                "type": "subleaf",
                "parent_uid": root_uid,
                "extract_id": sub_uid,
                "acronym": sub_acronym
            }

            # 2. Alias Expansion cho Subleaf (nếu Subleaf là Range)
            # VD: an1.281-283 -> an1.281, an1.282...
            parsed_sub = _parse_range_string(sub_uid)
            
            if parsed_sub:
                p_prefix, p_start, p_end = parsed_sub
                aliases = _expand_alias_ids(p_prefix, p_start, p_end)
                
                for alias_id in aliases:
                    if alias_id == sub_uid: continue
                    
                    # [FIX QUAN TRỌNG] Thêm Alias vào Structure để được Index
                    ordered_structure_ids.append(alias_id) # <--- DÒNG NÀY ĐÃ BỊ THIẾU

                    # Acronym logic
                    try:
                        a_num = int(alias_id[len(p_prefix):])
                        base_acronym = sub_acronym if sub_acronym else parent_acronym
                        alias_acronym = _generate_smart_acronym(base_acronym, p_start, p_end, a_num)
                    except ValueError:
                        alias_acronym = ""

                    result_meta[alias_id] = {
                        "type": "alias",
                        "parent_uid": root_uid, # Trỏ về file gốc
                        "extract_id": sub_uid,  # Trỏ về đoạn trích (Subleaf)
                        "acronym": alias_acronym
                    }

        return ordered_structure_ids, result_meta