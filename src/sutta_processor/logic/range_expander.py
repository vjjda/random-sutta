# Path: src/sutta_processor/logic/range_expander.py
import re
import logging
from typing import Dict, Any, List, Tuple, Set, Optional

logger = logging.getLogger("SuttaProcessor.Logic.RangeExpander")

ARTICLE_ID_PATTERN = re.compile(r"<article[^>]*\sid=['\"]([^'\"]+)['\"]", re.IGNORECASE)
RANGE_PATTERN = re.compile(r"^(.*?)(\d+)[-–](\d+)$")

def _parse_range_string(uid: str) -> Optional[Tuple[str, int, int]]:
    match = RANGE_PATTERN.match(uid)
    if match:
        prefix = match.group(1)
        try:
            start = int(match.group(2))
            end = int(match.group(3))
            if start < end and (end - start) < 1000: 
                return prefix, start, end
        except ValueError:
            pass
    return None

def _expand_alias_ids(prefix: str, start: int, end: int) -> List[str]:
    return [f"{prefix}{i}" for i in range(start, end + 1)]

def _extract_unique_article_ids(content: Dict[str, Any]) -> List[str]:
    found_ids = []
    seen_ids = set()
    sorted_keys = sorted(content.keys(), key=lambda x: [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', x)])

    for seg_key in sorted_keys:
        html = content[seg_key].get("html", "")
        if not html: continue
        matches = ARTICLE_ID_PATTERN.findall(html)
        for aid in matches:
            if aid not in seen_ids:
                seen_ids.add(aid)
                found_ids.append(aid)
    return found_ids

def _generate_smart_acronym(parent_acronym: str, start: int, end: int, replacement: str) -> str:
    if not parent_acronym: return ""
    range_pattern = re.compile(rf"{start}\s*[-–]\s*{end}")
    new_acronym = range_pattern.sub(str(replacement), parent_acronym)
    return new_acronym if new_acronym != parent_acronym else ""

def generate_subleaf_shortcuts(
    root_uid: str, 
    content: Dict[str, Any], 
    parent_acronym: str = ""
) -> Tuple[List[str], Dict[str, Any]]:
    
    result_meta = {}
    ordered_structure_ids = []
    article_ids = _extract_unique_article_ids(content)
    root_range_info = _parse_range_string(root_uid)

    # --- CASE A: SINGLE LEAF (Bài đơn hoặc range gộp) ---
    if len(article_ids) <= 1:
        if root_range_info:
            prefix, start, end = root_range_info
            aliases = _expand_alias_ids(prefix, start, end)
            if len(aliases) > 0:
                logger.info(f"   ✨ Single Leaf Range Expansion: {root_uid} -> {len(aliases)} aliases")

            for alias_id in aliases:
                if alias_id == root_uid: continue
                # [ALIAS TYPE 1] Trỏ về bài gốc, không có hash cụ thể
                result_meta[alias_id] = {
                    "type": "alias",
                    "target_uid": root_uid,
                    "hash_id": None
                }
        return [root_uid], result_meta

    # --- CASE B: MULTI SUBLEAFS (Nhiều bài con trong 1 file) ---
    else:
        logger.info(f"   🌿 HTML Articles Detected: {root_uid} -> {len(article_ids)} subleafs")

        for sub_uid in article_ids:
            ordered_structure_ids.append(sub_uid)
            
            sub_acronym = ""
            if root_range_info:
                r_prefix, r_start, r_end = root_range_info
                if sub_uid.startswith(r_prefix):
                    suffix = sub_uid[len(r_prefix):]
                    display_suffix = suffix.replace("-", "–")
                    sub_acronym = _generate_smart_acronym(parent_acronym, r_start, r_end, display_suffix)

            # [SUBLEAF] Là một phần tử thực
            result_meta[sub_uid] = {
                "type": "subleaf",
                "parent_uid": root_uid,
                "extract_id": sub_uid,
                "acronym": sub_acronym
            }

            # Kiểm tra xem Subleaf này có phải là range không (Nested Range)
            # Ví dụ: sub_uid = "an1.395-401"
            sub_range = _parse_range_string(sub_uid)
            if sub_range:
                p_prefix, p_start, p_end = sub_range
                aliases = _expand_alias_ids(p_prefix, p_start, p_end)
                
                for alias_id in aliases:
                    if alias_id == sub_uid: continue
                    
                    # [ALIAS TYPE 2] Trỏ về bài gốc (root_uid), nhưng cuộn tới Subleaf (sub_uid)
                    result_meta[alias_id] = {
                        "type": "alias",
                        "target_uid": root_uid,  # File vật lý
                        "hash_id": sub_uid       # Anchor
                    }

        return ordered_structure_ids, result_meta