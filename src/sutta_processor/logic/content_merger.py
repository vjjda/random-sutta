# Path: src/sutta_processor/logic/content_merger.py
import json
import logging
import re
from pathlib import Path
from typing import Dict, Optional, Tuple, Any

# [NEW] Import Config để biết sách nào là nội bộ
from ..shared.app_config import CONFIG_PRIMARY_BOOKS

logger = logging.getLogger("SuttaProcessor.Logic.Merger")

# Tạo set để tra cứu O(1)
# Bao gồm cả các sách chính và các biến thể phổ biến nếu cần
INTERNAL_BOOKS = set(CONFIG_PRIMARY_BOOKS)

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

def _get_book_id(uid: str) -> str:
    """Trích xuất mã sách từ UID (vd: mn1 -> mn, an1.1 -> an)."""
    match = re.match(r"^([a-z]+)", uid.lower())
    return match.group(1) if match else ""

def _sanitize_links(text: str) -> str:
    """
    Chuyển đổi link SuttaCentral sang link nội bộ THÔNG MINH.
    Chỉ chuyển đổi nếu sách đích nằm trong CONFIG_PRIMARY_BOOKS.
    """
    if not text or "suttacentral.net" not in text:
        return text

    # Pattern bắt link: https://suttacentral.net/{uid}/...
    pattern = r"https://suttacentral\.net/([a-zA-Z0-9\.-]+)/[^/]+/[^/#\"']+(?:#([a-zA-Z0-9\.\:-]+))?"
    
    def repl(match):
        uid = match.group(1)
        fragment = match.group(2)
        
        # [SMART CHECK] Kiểm tra xem UID này có thuộc sách nội bộ không
        book_id = _get_book_id(uid)
        
        # Nếu sách KHÔNG nằm trong danh sách hỗ trợ -> Giữ nguyên link gốc
        if book_id not in INTERNAL_BOOKS:
            # Trả về toàn bộ chuỗi khớp ban đầu (không thay đổi)
            return match.group(0)

        # Nếu sách hỗ trợ -> Chuyển sang internal link
        new_link = f"index.html?q={uid}"
        if fragment:
            new_link += f"#{fragment}"
        return new_link

    return re.sub(pattern, repl, text)

def process_worker(args: Tuple[str, Path, Optional[Path], Optional[Path], Optional[Path], Optional[str]]) -> Tuple[str, str, Optional[Dict[str, Any]]]:
    # [OPTIMIZED] Unpack expanded tuple with pre-resolved paths
    sutta_id, root_path, trans_path, html_path, comment_path, author_uid = args
    
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
            
            # [UPDATED] Áp dụng sanitize links thông minh cho comment
            if comm: entry["comm"] = _sanitize_links(comm)
            
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