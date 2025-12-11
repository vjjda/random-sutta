# Path: src/sutta_processor/logic/range_expander.py
import re
import logging
from typing import Dict, Any, List, Tuple, Set, Optional

logger = logging.getLogger("SuttaProcessor.Logic.RangeExpander")

ARTICLE_ID_PATTERN = re.compile(r"<article[^>]*\sid=['\"]([^'\"]+)['\"]", re.IGNORECASE)
RANGE_PATTERN = re.compile(r"^(.*?)(\d+)[-–](\d+)$")

# Định nghĩa các quy tắc Regex cho Vinaya
VINAYA_REGEX_RULES = [
    # 1. Bhikkhuni Vibhanga (pli-tv-bi-vb-pj1 -> ipj1)
    (re.compile(r"^pli-tv-bi-vb-(.+)$"), r"i\1"),
    # 2. Bhikkhu Vibhanga (pli-tv-bu-vb-pj1 -> pj1)
    (re.compile(r"^pli-tv-bu-vb-(.+)$"), r"\1"),
    # 3. General Bhikkhuni (pli-tv-bi-pc1 -> ipc1)
    (re.compile(r"^pli-tv-bi-(.+)$"), r"i\1"),
    # 4. General Bhikkhu (pli-tv-bu-pc1 -> pc1)
    (re.compile(r"^pli-tv-bu-(.+)$"), r"\1"),
    # 5. General Vinaya (pli-tv-kd1 -> kd1)
    (re.compile(r"^pli-tv-(.+)$"), r"\1"),
]

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

def _generate_vinaya_variants(uid: str) -> Set[str]:
    """Sinh ra các biến thể tên gọi (Alias) dựa trên quy tắc Vinaya."""
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

    # --- CASE A: SINGLE LEAF (Bài đơn hoặc range gộp) ---
    # Ví dụ: pli-tv-bi-vb-pj1-4
    if len(article_ids) <= 1:
        # Mặc định structure là chính nó
        ordered_structure_ids.append(root_uid)

        if root_range_info:
            prefix, start, end = root_range_info
            aliases = _expand_alias_ids(prefix, start, end)
            if len(aliases) > 0:
                logger.info(f"   ✨ Single Leaf Range Expansion: {root_uid} -> {len(aliases)} aliases")

            for alias_id in aliases:
                if alias_id == root_uid: continue
                # [ALIAS TYPE 1] Trỏ về bài gốc
                result_meta[alias_id] = {
                    "type": "alias",
                    "target_uid": root_uid,
                    "hash_id": None
                }
        
        # [LƯU Ý] Không return ngay ở đây nữa! Để code chạy tiếp xuống phần Post-process.

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

            # [SUBLEAF]
            result_meta[sub_uid] = {
                "type": "subleaf",
                "parent_uid": root_uid,
                "extract_id": sub_uid,
                "acronym": sub_acronym
            }

            # Kiểm tra Nested Range (Sub-Alias)
            sub_range = _parse_range_string(sub_uid)
            if sub_range:
                p_prefix, p_start, p_end = sub_range
                aliases = _expand_alias_ids(p_prefix, p_start, p_end)
                
                for alias_id in aliases:
                    if alias_id == sub_uid: continue
                    
                    # [ALIAS TYPE 2]
                    result_meta[alias_id] = {
                        "type": "alias",
                        "target_uid": root_uid,
                        "hash_id": sub_uid
                    }

    # =================================================================
    # [UNIVERSAL POST-PROCESS] SINH BIẾN THỂ VINAYA
    # =================================================================
    
    # 1. Sinh biến thể cho Root UID (ví dụ: ivb-pj1-4 -> ipj1-4)
    root_variants = _generate_vinaya_variants(root_uid)
    for var_uid in root_variants:
        if var_uid not in result_meta:
            result_meta[var_uid] = {
                "type": "alias",
                "target_uid": root_uid,
                "hash_id": None
            }

    # 2. Sinh biến thể cho TẤT CẢ items hiện có trong result_meta
    # (Bao gồm Subleaf và các Alias chuẩn vừa tạo ở Case A hoặc B)
    # Dùng list(keys) để snapshot, tránh lỗi runtime khi dictionary thay đổi size
    current_keys = list(result_meta.keys())
    
    for item_uid in current_keys:
        item_data = result_meta[item_uid]
        variants = _generate_vinaya_variants(item_uid)
        
        # Kế thừa đích đến từ item gốc
        final_target = item_data.get("target_uid") or item_data.get("parent_uid")
        final_hash = item_data.get("hash_id") or item_data.get("extract_id")

        # Đặc biệt: Nếu item gốc là Alias trong Case A (Target là Root),
        # thì biến thể Vinaya của nó cũng phải trỏ về Root.
        if item_data["type"] == "alias" and not final_hash and not final_target:
             # Fallback an toàn nếu data thiếu (thường không xảy ra với logic trên)
             final_target = root_uid

        for var_uid in variants:
            # Chỉ tạo nếu chưa tồn tại (tránh ghi đè Subleaf thật hoặc Alias đã có)
            if var_uid not in result_meta and var_uid not in ordered_structure_ids:
                result_meta[var_uid] = {
                    "type": "alias",
                    "target_uid": final_target,
                    "hash_id": final_hash
                }

    return ordered_structure_ids, result_meta