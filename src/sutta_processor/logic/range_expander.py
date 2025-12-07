# Path: src/sutta_processor/logic/range_expander.py
import re
import logging
from typing import Dict, Any, List, Tuple, Set, Optional

logger = logging.getLogger("SuttaProcessor.Logic.RangeExpander")

def _natural_keys(text: str) -> List[Any]:
    """Helper để sort 'an1.2' sau 'an1.1' thay vì 'an1.10'."""
    return [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', text)]

def _parse_range_string(uid: str) -> Optional[Tuple[str, int, int]]:
    """
    Kiểm tra xem UID có phải dạng range không (vd: dhp1-20, an1.281-283).
    Regex tìm số cuối cùng và số liền trước nó ngăn cách bởi dấu gạch ngang.
    """
    # Group 1: Prefix (an1.281 hoặc dhp)
    # Group 2: Start (281 hoặc 1)
    # Group 3: End (283 hoặc 20)
    # Regex: Tìm dấu gạch ngang [-–] nằm giữa 2 con số ở cuối chuỗi
    pattern = re.compile(r"^(.*?)(\d+)[-–](\d+)$")
    match = pattern.match(uid)
    
    if match:
        prefix = match.group(1) # Lưu ý: prefix này có thể chứa cả số (vd: an1.)
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
    """Sinh danh sách ID con từ range (chỉ dùng làm Alias)."""
    # Giới hạn safety check để tránh loop vô tận nếu range quá lớn
    if (end - start) > 500:
        return []
    return [f"{prefix}{i}" for i in range(start, end + 1)]

def _generate_smart_acronym(parent_acronym: str, start: int, end: int, current_num: int) -> str:
    if not parent_acronym: return ""
    # Thay thế dải số trong acronym cha bằng số hiện tại
    # Vd: "Dhp 1-20" -> "Dhp 1", "Dhp 5"
    range_pattern = re.compile(rf"{start}\s*[-–]\s*{end}")
    new_acronym = range_pattern.sub(str(current_num), parent_acronym)
    if new_acronym == parent_acronym: 
        return "" # Fallback nếu không replace được
    return new_acronym

def generate_subleaf_shortcuts(
    root_uid: str, 
    content: Dict[str, Any], 
    parent_acronym: str = ""
) -> Tuple[List[str], Dict[str, Any]]:
    """
    Xử lý thông minh dựa trên Segment ID thực tế.
    Trả về: (Danh sách ID cấu trúc, Dict chứa Meta Subleaf/Alias)
    """
    result_meta = {}
    ordered_structure_ids = []

    # 1. Quét Content để tìm các Prefix thực tế (Truth Source)
    # Segment ID format: "uid:segment_num" (vd: "dhp1:1.1")
    real_prefixes = set()
    for seg_id in content.keys():
        if ":" in seg_id:
            prefix = seg_id.split(":")[0]
            real_segment_prefix = prefix
            
            # [Edge Case] Đôi khi file bilara có uid khác chút so với segment prefix
            # Nhưng ở đây ta quan tâm việc segment prefix CÓ KHÁC root_uid không.
            real_prefixes.add(real_segment_prefix)

    # Sort để đảm bảo thứ tự trong cây (Tree)
    sorted_prefixes = sorted(list(real_prefixes), key=_natural_keys)

    # 2. Phân loại Logic
    
    # CASE A: Không tìm thấy subleaf (Prefix khớp Root) hoặc File rỗng
    # -> Đây là Leaf đơn (hoặc Range Leaf chưa bung).
    is_single_leaf = (len(sorted_prefixes) == 0) or \
                     (len(sorted_prefixes) == 1 and sorted_prefixes[0] == root_uid)

    if is_single_leaf:
        # Giữ nguyên cấu trúc (trả về root_uid).
        # Nhưng kiểm tra xem Root có phải là Range để bung Alias không?
        parsed = _parse_range_string(root_uid)
        
        if parsed:
            prefix, start, end = parsed
            aliases = _expand_alias_ids(prefix, start, end)
            
            for alias_id in aliases:
                if alias_id == root_uid: continue
                
                # Tạo Alias trỏ về Root
                result_meta[alias_id] = {
                    "type": "alias",
                    "parent_uid": root_uid,
                    # Alias này trỏ về toàn bộ file cha, không cần extract riêng
                    "extract_id": None, 
                    "acronym": _generate_smart_acronym(parent_acronym, start, end, int(alias_id.replace(prefix, "")))
                }
        
        return [root_uid], result_meta

    # CASE B: Có Subleaves (Prefix khác Root)
    # -> Cấu trúc cây sẽ thay đổi: Root biến thành Container chứa các Subleaves
    else:
        for sub_uid in sorted_prefixes:
            ordered_structure_ids.append(sub_uid)
            
            # Định nghĩa Subleaf Meta
            # Lưu ý: Subleaf trỏ content về chính nó (để extractor lọc theo prefix này)
            result_meta[sub_uid] = {
                "type": "subleaf",
                "parent_uid": root_uid,
                "extract_id": sub_uid,
                # Subleaf không cần acronym giả, nó sẽ lấy từ meta gốc nếu có hoặc FE tự xử lý
            }

            # Kiểm tra xem Subleaf này CÓ PHẢI LÀ RANGE không? (vd: an1.281-283)
            parsed_sub = _parse_range_string(sub_uid)
            
            if parsed_sub:
                prefix, start, end = parsed_sub
                aliases = _expand_alias_ids(prefix, start, end)
                
                for alias_id in aliases:
                    if alias_id == sub_uid: continue
                    
                    # Alias trỏ về Root (để load file), nhưng extract_id là Subleaf Range
                    result_meta[alias_id] = {
                        "type": "alias",
                        "parent_uid": root_uid,
                        "extract_id": sub_uid, # Quan trọng: Alias này thuộc về Subleaf Range này
                        "acronym": _generate_smart_acronym(parent_acronym, start, end, int(alias_id.replace(prefix, "")))
                    }

        return ordered_structure_ids, result_meta