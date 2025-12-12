# Path: src/sutta_processor/logic/content_merger.py
import json
import logging
import re
from pathlib import Path
from typing import Dict, Optional, Tuple, Any, FrozenSet

logger = logging.getLogger("SuttaProcessor.Logic.Merger")

def load_json(path: Path) -> Dict[str, str]:
    if not path or not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def natural_keys(text: str):
    return [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', text)]

def _get_base_uid(uid: str) -> str:
    """
    Trích xuất Base UID (vd: 'mn1' từ 'mn1#2.3').
    Loại bỏ anchor (#...) và segment id (:...).
    """
    # Xóa fragment #...
    base = uid.split('#')[0]
    # Xóa segment :... (nếu có trong link thô)
    base = base.split(':')[0]
    return base.lower()

def _sanitize_links(text: str, valid_uids: FrozenSet[str], current_sutta_id: str) -> str:
    """
    Chuyển đổi link SuttaCentral sang link nội bộ nều UID đích tồn tại trong valid_uids.
    Log cảnh báo ra Console nếu phát hiện link nội bộ tiềm năng nhưng thiếu dữ liệu.
    """
    if not text or "suttacentral.net" not in text:
        return text

    # Pattern bắt link: https://suttacentral.net/{uid}/...
    pattern = r"https://suttacentral\.net/([a-zA-Z0-9\.-]+)/[^/]+/[^/#\"']+(?:#([a-zA-Z0-9\.\:-]+))?"
    
    def repl(match):
        uid_raw = match.group(1) # Vd: mn1, an1.1, pli-tv-kd1
        fragment = match.group(2) # Vd: 3.4
        
        # [SMART CHECK]
        # 1. Clean UID để check trong map (loại bỏ anchor nếu có lọt vào)
        target_uid = _get_base_uid(uid_raw)
        
        # 2. Kiểm tra sự tồn tại trong Vũ trụ UID
        if target_uid in valid_uids:
            # OK -> Chuyển sang internal link
            new_link = f"index.html?q={target_uid}"
            if fragment:
                new_link += f"#{fragment}"
            return new_link
        
        # 3. Logic cảnh báo:
        # Nếu link có vẻ là link kinh điển (bắt đầu bằng chữ cái thường) nhưng không tìm thấy
        # (Loại trừ các trang tĩnh như 'home', 'about', hoặc uid lằng nhằng của SC)
        if re.match(r"^[a-z]+[\d\.]+", target_uid):
             logger.warning(f"   ⚠️  MISSING LINK: '{target_uid}' (referenced in {current_sutta_id}) not found in offline data.")
        
        # Trả về link gốc (External)
        return match.group(0)

    return re.sub(pattern, repl, text)

# [UPDATED SIGNATURE] Thêm valid_uids vào cuối
def process_worker(args: Tuple[str, Path, Optional[Path], Optional[Path], Optional[Path], Optional[str], FrozenSet[str]]) -> Tuple[str, str, Optional[Dict[str, Any]]]:
    # Unpack
    sutta_id, root_path, trans_path, html_path, comment_path, author_uid, valid_uids = args
    
    try:
        # Pre-check: If HTML missing, skip immediately
        if not html_path:
            return "skipped", sutta_id, None

        data_root = load_json(root_path)
        data_trans = load_json(trans_path)
        data_html = load_json(html_path)
        data_comment = load_json(comment_path)

        all_keys = set(data_root.keys()) | set(data_html.keys())
        if data_trans:
            all_keys |= set(data_trans.keys())
            
        sorted_keys = sorted(list(all_keys), key=natural_keys)

        segments_dict = {} 
        has_content = False
        
        for key in sorted_keys:
            pali = data_root.get(key)
            eng = data_trans.get(key)
            html = data_html.get(key)
            comm = data_comment.get(key)
            
            if not (pali or eng or html):
                continue

            has_content = True
            
            entry = {}
            if pali: entry["pli"] = pali
            if eng: entry["eng"] = eng
            if html: entry["html"] = html
            
            # [UPDATED] Pass valid_uids để check
            if comm: entry["comm"] = _sanitize_links(comm, valid_uids, sutta_id)
            
            segments_dict[key] = entry

        if not has_content:
             return "skipped", sutta_id, None

        final_data = {
            "author_uid": author_uid,
            "data": segments_dict 
        }

        return "success", sutta_id, final_data

    except Exception as e:
        logger.error(f"Error processing {sutta_id}: {e}")
        return "error", sutta_id, None