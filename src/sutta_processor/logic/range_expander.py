# Path: src/sutta_processor/logic/range_expander.py
import re
import logging
from typing import Dict, Any, List, Tuple, Set, Optional

logger = logging.getLogger("SuttaProcessor.Logic.RangeExpander")

def _natural_keys(text: str) -> List[Any]:
    return [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', text)]

def _parse_range_string(uid: str) -> Optional[Tuple[str, int, int]]:
    """
    Parse UID dạng range: prefix + start + end.
    Ví dụ: 'dhp1-20' -> ('dhp', 1, 20)
           'an1.281-283' -> ('an1.', 281, 283)
    """
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
    """
    Sinh Acronym con từ Acronym cha.
    VD: Cha="Dhp 1-20", Num=5 -> Con="Dhp 5"
    """
    if not parent_acronym: return ""
    
    # Regex tìm dải số trong acronym cha (vd: "1-20" hoặc "1–20")
    range_pattern = re.compile(rf"{start}\s*[-–]\s*{end}")
    
    # Thay thế dải số bằng số hiện tại
    new_acronym = range_pattern.sub(str(current_num), parent_acronym)
    
    # Nếu không replace được (do format lạ), fallback bằng cách ghép số vào cuối
    if new_acronym == parent_acronym:
        # Fallback đơn giản: "AcronymCha (Num)" hoặc giữ nguyên thì hơi kỳ
        # Tạm thời trả về acronym cha nếu không parse được, hoặc "" để FE tự fallback theo UID
        return "" 
        
    return new_acronym

def generate_subleaf_shortcuts(
    root_uid: str, 
    content: Dict[str, Any], 
    parent_acronym: str = ""
) -> Tuple[List[str], Dict[str, Any]]:
    result_meta = {}
    ordered_structure_ids = []

    # 1. Quét Content để tìm Subleaves thực tế
    real_prefixes = set()
    for seg_id in content.keys():
        if ":" in seg_id:
            prefix = seg_id.split(":")[0]
            real_prefixes.add(prefix)

    sorted_prefixes = sorted(list(real_prefixes), key=_natural_keys)

    # Helper: Parse thông tin Range của Root (nếu có)
    root_range_info = _parse_range_string(root_uid)

    # CASE A: Single Leaf (Không có subleaf hoặc chỉ có chính nó)
    is_single_leaf = (len(sorted_prefixes) == 0) or \
                     (len(sorted_prefixes) == 1 and sorted_prefixes[0] == root_uid)

    if is_single_leaf:
        # Check Alias Expansion (Virtual IDs)
        if root_range_info:
            prefix, start, end = root_range_info
            aliases = _expand_alias_ids(prefix, start, end)
            
            for alias_id in aliases:
                if alias_id == root_uid: continue
                
                # Tính số thứ tự của alias để tạo Acronym
                # alias_id = "dhp5", prefix="dhp" -> num=5
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

    # CASE B: Có Subleaves (Container)
    else:
        for sub_uid in sorted_prefixes:
            ordered_structure_ids.append(sub_uid)
            
            # 1. Tính Acronym cho Subleaf
            # Nếu Root là Range (dhp1-20) và Subleaf khớp prefix (dhp1) -> Sinh Acronym
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
            
            # Nếu không sinh được smart acronym, để trống (FE sẽ dùng Title hoặc UID)
            
            result_meta[sub_uid] = {
                "type": "subleaf",
                "parent_uid": root_uid,
                "extract_id": sub_uid,
                "acronym": sub_acronym
            }

            # 2. Check Alias cho Subleaf (nếu Subleaf bản thân nó lại là Range)
            # Ví dụ: root="an1.278-286", sub="an1.281-283"
            parsed_sub = _parse_range_string(sub_uid)
            
            if parsed_sub:
                p_prefix, p_start, p_end = parsed_sub
                aliases = _expand_alias_ids(p_prefix, p_start, p_end)
                
                for alias_id in aliases:
                    if alias_id == sub_uid: continue
                    
                    # Tính Acronym cho Alias của Subleaf
                    # Dùng sub_acronym làm cha để replace tiếp
                    try:
                        a_num = int(alias_id[len(p_prefix):])
                        # Nếu Subleaf có acronym (vd: "AN 1.281-283"), ta dùng nó để sinh "AN 1.281"
                        # Nếu không, dùng parent gốc
                        base_acronym = sub_acronym if sub_acronym else parent_acronym
                        # Lưu ý: Nếu dùng parent gốc (range to 278-286), mà alias này là 281 -> vẫn match range
                        # Tốt nhất là cố gắng sinh từ base chính xác nhất.
                        
                        alias_acronym = _generate_smart_acronym(base_acronym, p_start, p_end, a_num)
                    except ValueError:
                        alias_acronym = ""

                    result_meta[alias_id] = {
                        "type": "alias",
                        "parent_uid": root_uid, # Vẫn trỏ về file cha to nhất để load
                        "extract_id": sub_uid,  # Nhưng extract đoạn con
                        "acronym": alias_acronym
                    }

        return ordered_structure_ids, result_meta