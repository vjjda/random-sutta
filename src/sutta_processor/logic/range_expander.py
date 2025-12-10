# Path: src/sutta_processor/logic/range_expander.py
import re
import logging
from typing import Dict, Any, List, Tuple, Set, Optional

logger = logging.getLogger("SuttaProcessor.Logic.RangeExpander")

# Regex để bắt ID trong thẻ article.
# Hỗ trợ cả single quote (') và double quote (")
# <article id='an1.394'> hoặc <article class='...' id="an1.394">
ARTICLE_ID_PATTERN = re.compile(r"<article[^>]*\sid=['\"]([^'\"]+)['\"]", re.IGNORECASE)

# Regex xác định range (ví dụ: an1.394-574)
# Lookbehind (?<=\D) đảm bảo ký tự trước đó không phải số (để tránh bắt nhầm bên trong số)
RANGE_PATTERN = re.compile(r"^(.*?)(\d+)[-–](\d+)$")

def _parse_range_string(uid: str) -> Optional[Tuple[str, int, int]]:
    """Phân tích chuỗi UID để xem có phải là range không."""
    match = RANGE_PATTERN.match(uid)
    if match:
        prefix = match.group(1)
        start_str = match.group(2)
        end_str = match.group(3)
        try:
            start = int(start_str)
            end = int(end_str)
            # Giới hạn range hợp lý để tránh loop vô tận nếu data lỗi
            if start < end and (end - start) < 1000: 
                return prefix, start, end
        except ValueError:
            pass
    return None

def _expand_alias_ids(prefix: str, start: int, end: int) -> List[str]:
    """Sinh danh sách ID từ range."""
    return [f"{prefix}{i}" for i in range(start, end + 1)]

def _extract_unique_article_ids(content: Dict[str, Any]) -> List[str]:
    """
    Quét toàn bộ HTML segment để tìm các thẻ <article id='...'>
    Trả về danh sách unique ID duy trì thứ tự xuất hiện.
    """
    found_ids = []
    seen_ids = set()

    # Sắp xếp segment để đảm bảo thứ tự article tìm được khớp với thứ tự đọc
    # (Mặc dù content dict thường đã sort, nhưng sort lại cho chắc chắn)
    sorted_segments = sorted(content.keys(), key=lambda x: [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', x)])

    for seg_key in sorted_segments:
        segment = content[seg_key]
        html = segment.get("html", "")
        if not html:
            continue
        
        # Tìm tất cả article tags trong segment này (thường chỉ 1, nhưng đề phòng gộp dòng)
        matches = ARTICLE_ID_PATTERN.findall(html)
        for aid in matches:
            if aid not in seen_ids:
                seen_ids.add(aid)
                found_ids.append(aid)
    
    return found_ids

def _generate_smart_acronym(parent_acronym: str, start: int, end: int, replacement: str) -> str:
    """Tạo Acronym thông minh cho subleaf."""
    if not parent_acronym: return ""
    # Tìm chuỗi số khớp với range cha để thay thế
    # Ví dụ Parent AN 1.394-574 -> Subleaf 1.395-401 -> Acronym AN 1.395–401
    range_pattern = re.compile(rf"{start}\s*[-–]\s*{end}")
    new_acronym = range_pattern.sub(str(replacement), parent_acronym)
    if new_acronym == parent_acronym: return "" 
    return new_acronym

def generate_subleaf_shortcuts(
    root_uid: str, 
    content: Dict[str, Any], 
    parent_acronym: str = ""
) -> Tuple[List[str], Dict[str, Any]]:
    """
    Xác định Subleaf và Alias dựa trên thẻ <article> trong HTML.
    """
    result_meta = {}
    ordered_structure_ids = []

    # 1. Quét Article ID từ HTML
    article_ids = _extract_unique_article_ids(content)
    
    # Lấy thông tin range của file gốc (nếu có)
    root_range_info = _parse_range_string(root_uid)

    # --- CASE A: SINGLE LEAF (Ít hơn hoặc bằng 1 article) ---
    # File này là một bài kinh trọn vẹn, hoặc data chưa chuẩn.
    # Xử lý như cũ: Nếu tên file là Range -> Bung Alias trỏ về chính nó.
    if len(article_ids) <= 1:
        if root_range_info:
            prefix, start, end = root_range_info
            aliases = _expand_alias_ids(prefix, start, end)
            
            if len(aliases) > 0:
                logger.info(f"   ✨ Single Leaf Range Expansion: {root_uid} -> {len(aliases)} aliases")

            for alias_id in aliases:
                if alias_id == root_uid: continue
                
                result_meta[alias_id] = {
                    "type": "alias",
                    "parent_uid": root_uid,
                    "target_uid": root_uid, # Trỏ về chính file này
                    "extract_id": None      # Không cần scroll cụ thể vì là bài đơn
                }
        
        # Trả về chính nó là structure
        return [root_uid], result_meta

    # --- CASE B: MULTI SUBLEAFS (Nhiều Articles) ---
    else:
        logger.info(f"   🌿 HTML Articles Detected: {root_uid} -> {len(article_ids)} subleafs")

        for sub_uid in article_ids:
            ordered_structure_ids.append(sub_uid)
            
            # Tính toán Acronym cho Subleaf
            sub_acronym = ""
            if root_range_info:
                root_prefix, r_start, r_end = root_range_info
                # Cố gắng khớp prefix (ví dụ an1.394 so với an1.)
                if sub_uid.startswith(root_prefix):
                    suffix = sub_uid[len(root_prefix):]
                    display_suffix = suffix.replace("-", "–")
                    sub_acronym = _generate_smart_acronym(parent_acronym, r_start, r_end, display_suffix)

            # 1. Tạo Subleaf Meta
            result_meta[sub_uid] = {
                "type": "subleaf",
                "parent_uid": root_uid,
                "extract_id": sub_uid, # Scroll tới ID này
                "acronym": sub_acronym
            }

            # 2. Kiểm tra Nested Range (Subleaf này có phải là range không?)
            # Ví dụ: sub_uid = "an1.395-401"
            sub_range = _parse_range_string(sub_uid)
            if sub_range:
                p_prefix, p_start, p_end = sub_range
                aliases = _expand_alias_ids(p_prefix, p_start, p_end)
                
                if len(aliases) > 0:
                    # logger.info(f"      ↳ Nested Alias: {sub_uid} -> {len(aliases)} items")
                    pass

                for alias_id in aliases:
                    # Nếu alias trùng tên với subleaf (hiếm khi xảy ra nếu là range), bỏ qua
                    if alias_id == sub_uid: continue
                    
                    # [QUAN TRỌNG] Tạo Alias trỏ về FILE MẸ (root_uid)
                    # Nhưng kèm theo extract_id (hash_id) là sub_uid
                    result_meta[alias_id] = {
                        "type": "alias",
                        "parent_uid": root_uid,     # Vẫn thuộc file mẹ
                        "target_uid": root_uid,     # Load file mẹ
                        "extract_id": sub_uid       # Hash anchor: #an1.395-401
                    }

        return ordered_structure_ids, result_meta