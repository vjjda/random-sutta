# Path: src/sutta_processor/logic/range_expander.py
import re
import logging
from typing import Dict, Any, List, Tuple, Set, Optional

logger = logging.getLogger("SuttaProcessor.Logic.RangeExpander")

ARTICLE_ID_PATTERN = re.compile(r"<article[^>]*\sid=['\"]([^'\"]+)['\"]", re.IGNORECASE)
RANGE_PATTERN = re.compile(r"^(.*?)(\d+)[-–](\d+)$")

# Định nghĩa các quy tắc Regex cho Vinaya
VINAYA_REGEX_RULES = [
    (re.compile(r"^pli-tv-bi-vb-(.+)$"), r"i\1"),
    (re.compile(r"^pli-tv-bu-vb-(.+)$"), r"\1"),
    (re.compile(r"^pli-tv-bi-(.+)$"), r"i\1"),
    (re.compile(r"^pli-tv-bu-(.+)$"), r"\1"),
    (re.compile(r"^pli-tv-(.+)$"), r"\1"),
]

def _parse_range_string(uid: str) -> Optional[Tuple[str, int, int]]:
    # [OPTIMIZATION] Fast fail: Nếu không có dấu gạch ngang, chắc chắn không phải range
    if "-" not in uid and "–" not in uid:
        return None
        
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

def expand_range_ids(uid: str) -> List[str]:
    """
    [PUBLIC] Phân tích UID dạng range (dhp383-423) và trả về danh sách các ID con.
    """
    range_info = _parse_range_string(uid)
    if range_info:
        prefix, start, end = range_info
        return _expand_alias_ids(prefix, start, end)
    return []

# ... (Giữ nguyên phần còn lại của file: _extract_unique_article_ids, generate_vinaya_variants, generate_subleaf_shortcuts) ...
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

def generate_vinaya_variants(uid: str) -> Set[str]:
    variants = set()
    for pattern, replacement in VINAYA_REGEX_RULES:
        if pattern.match(uid):
            alias = pattern.sub(replacement, uid)
            if alias and alias != uid:
                variants.add(alias)
    return variants

def generate_subleaf_shortcuts(
    root_uid: str, 
    content: Dict[str, Any], 
    parent_acronym: str = ""
) -> Tuple[List[str], Dict[str, Any]]:
    
    result_meta = {}
    ordered_structure_ids = []
    article_ids = _extract_unique_article_ids(content)
    root_range_info = _parse_range_string(root_uid)

    if len(article_ids) <= 1:
        ordered_structure_ids.append(root_uid)
        
        if root_range_info:
            prefix, start, end = root_range_info
            aliases = _expand_alias_ids(prefix, start, end)
            if len(aliases) > 0:
                logger.debug(f"   ✨ Single Leaf Range Expansion: {root_uid} -> {len(aliases)} aliases")

            for alias_id in aliases:
                if alias_id == root_uid: continue
                result_meta[alias_id] = {
                    "type": "alias",
                    "target_uid": root_uid,
                    "hash_id": None
                }

    else:
        logger.debug(f"   🌿 HTML Articles Detected: {root_uid} -> {len(article_ids)} subleafs")

        for sub_uid in article_ids:
            ordered_structure_ids.append(sub_uid)
            
            sub_acronym = ""
            if root_range_info:
                r_prefix, r_start, r_end = root_range_info
                if sub_uid.startswith(r_prefix):
                    suffix = sub_uid[len(r_prefix):]
                    display_suffix = suffix.replace("-", "–")
                    sub_acronym = _generate_smart_acronym(parent_acronym, r_start, r_end, display_suffix)

            result_meta[sub_uid] = {
                "type": "subleaf",
                "parent_uid": root_uid,
                "extract_id": sub_uid,
                "acronym": sub_acronym
            }

            sub_range = _parse_range_string(sub_uid)
            if sub_range:
                p_prefix, p_start, p_end = sub_range
                aliases = _expand_alias_ids(p_prefix, p_start, p_end)
                
                for alias_id in aliases:
                    if alias_id == sub_uid: continue
                    result_meta[alias_id] = {
                        "type": "alias",
                        "target_uid": root_uid,
                        "hash_id": sub_uid
                    }

    root_variants = generate_vinaya_variants(root_uid)
    for var_uid in root_variants:
        if var_uid not in result_meta:
            result_meta[var_uid] = {
                "type": "alias",
                "target_uid": root_uid,
                "hash_id": None
            }

    current_keys = list(result_meta.keys())
    
    for item_uid in current_keys:
        item_data = result_meta[item_uid]
        variants = generate_vinaya_variants(item_uid)
        
        final_target = item_data.get("target_uid") or item_data.get("parent_uid")
        final_hash = item_data.get("hash_id") or item_data.get("extract_id")

        if item_data["type"] == "alias" and not final_hash and not final_target:
             final_target = root_uid

        for var_uid in variants:
            if var_uid not in result_meta and var_uid not in ordered_structure_ids:
                result_meta[var_uid] = {
                    "type": "alias",
                    "target_uid": final_target,
                    "hash_id": final_hash
                }

    return ordered_structure_ids, result_meta