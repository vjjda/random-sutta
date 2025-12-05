# Path: src/sutta_processor/logic/range_expander.py
import re
import logging
from typing import Dict, Any, Set, Optional, Tuple

logger = logging.getLogger("SuttaProcessor.Logic.RangeExpander")

def _parse_range_uid(uid: str) -> Optional[Tuple[str, int, int]]:
    """
    Phân tích UID để xem có phải là dạng range gộp hay không.
    Sử dụng Regex neo cuối chuỗi để xử lý đa dạng định dạng (AN, SN, Vinaya...).
    
    Regex: (?<=\D)(\d+)-(\d+)$
    - (?<=\D): Lookbehind, đảm bảo ký tự trước range KHÔNG phải là số.
    - (\d+): Số bắt đầu (Group 1).
    - -: Dấu gạch nối.
    - (\d+): Số kết thúc (Group 2).
    - $: Kết thúc chuỗi.
    """
    pattern = re.compile(r"(?<=\D)(\d+)-(\d+)$")
    match = pattern.search(uid)
    
    if match:
        start_str = match.group(1)
        end_str = match.group(2)
        
        try:
            start = int(start_str)
            end = int(end_str)
            
            # Prefix là phần chuỗi nằm trước đoạn match
            # Ví dụ: pli-tv-bi-vb-as1-7 -> match '1-7' -> prefix 'pli-tv-bi-vb-as'
            prefix = uid[:match.start()]
            
            if start < end:
                 return prefix, start, end
        except ValueError:
            pass
            
    return None

def _find_explicit_child_ids(content: Dict[str, Any], prefix: str, start: int, end: int) -> Set[str]:
    """
    Quét content để tìm xem những ID con nào thực sự tồn tại (Explicit).
    Input content keys thường có dạng: 'uid:segment' (vd: an1.1:1.0)
    """
    explicit_ids = set()
    
    # Tạo tập hợp các ID con lý thuyết để so khớp nhanh
    potential_ids = {f"{prefix}{i}" for i in range(start, end + 1)}

    for segment_key in content.keys():
        # Tách lấy phần UID trước dấu hai chấm
        if ":" in segment_key:
            base_uid = segment_key.split(":")[0]
            if base_uid in potential_ids:
                explicit_ids.add(base_uid)
    
    return explicit_ids

def generate_range_shortcuts(root_uid: str, content: Dict[str, Any]) -> Dict[str, Any]:
    """
    Hàm chính để sinh ra metadata cho các shortcut.
    """
    result_meta = {}
    
    # 1. Parse Range
    parsed = _parse_range_uid(root_uid)
    if not parsed:
        return {}
        
    prefix, start, end = parsed
    
    # Safety: Giới hạn range để tránh treo nếu parse nhầm số quá lớn
    if (end - start) > 500:
        logger.warning(f"⚠️ Range too large for {root_uid} ({start}-{end}). Skipping expansion.")
        return {}

    # 2. Scan Content for Explicit IDs
    # content ở đây là dict của segments bên trong bài kinh đó
    explicit_ids = _find_explicit_child_ids(content, prefix, start, end)

    # 3. Generate Shortcuts loop
    for i in range(start, end + 1):
        child_uid = f"{prefix}{i}"
        
        # Bỏ qua nếu trùng với chính root_uid
        if child_uid == root_uid:
            continue
            
        is_explicit = child_uid in explicit_ids
        
        # Tạo Acronym đẹp: "an1.5" -> "AN 1.5", "sn56.100" -> "SN 56.100"
        # Logic đơn giản: Uppercase và thay dấu chấm đầu tiên bằng khoảng trắng nếu cần
        # Ở đây ta uppercase toàn bộ cho đơn giản.
        acronym_display = child_uid.upper().replace('.', ' ')

        # Logic Scroll & Implicit
        if is_explicit:
            # Bài kinh có nội dung riêng -> Scroll tới chính nó -> Highlight
            scroll_target = child_uid
            is_implicit = False
        else:
            # Bài kinh bị gộp -> Scroll tới đầu bài cha -> Không highlight
            scroll_target = root_uid
            is_implicit = True

        shortcut_entry = {
            "type": "shortcut",
            "parent_uid": root_uid,
            "acronym": acronym_display,
            "scroll_target": scroll_target,
            "is_implicit": is_implicit
            # Không tạo translated_title để giảm tải, Frontend sẽ dùng Acronym
        }
        
        result_meta[child_uid] = shortcut_entry

    if result_meta:
        logger.info(f"   ✨ Expanded {root_uid} -> {len(result_meta)} shortcuts ({start}-{end})")

    return result_meta