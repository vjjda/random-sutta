# Path: src/sutta_processor/converter.py
import json
import re
import logging
from pathlib import Path
from typing import Dict, Optional, Tuple, Any, List

from .config import DATA_ROOT

logger = logging.getLogger("SuttaProcessor")

def load_json(path: Path) -> Dict[str, str]:
    if not path or not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def get_file_path(sutta_id: str, category: str, author_uid: str = None) -> Optional[Path]:
    """
    Xác định đường dẫn file dựa trên thông tin đã biết (Direct Lookup).
    Không dùng glob bừa bãi nữa.
    """
    if category == "translation":
        # translation/en/sujato/sutta/mn/.../mn1_translation-en-sujato.json
        # Nhưng ta không biết chắc nó nằm ở sub-folder nào (kn/dhp hay mn).
        # Nên vẫn phải dùng rglob nhưng giới hạn phạm vi trong folder tác giả.
        if not author_uid: return None
        base = DATA_ROOT / "translation" / "en" / author_uid
        pattern = f"{sutta_id}_translation-en-{author_uid}.json"
    
    elif category == "html":
        # html/sutta/mn/.../mn1_html.json
        base = DATA_ROOT / "html"
        pattern = f"{sutta_id}_html.json"
        
    elif category == "comment":
        # comment/en/sujato/sutta/...
        # Mặc định comment lấy của Sujato (hoặc theo cấu trúc folder comment/en)
        base = DATA_ROOT / "comment" / "en"
        pattern = f"{sutta_id}_comment-en-*.json"
    
    else:
        return None

    if not base.exists(): return None
    
    # Tìm nhanh file
    found = list(base.rglob(pattern))
    return found[0] if found else None

def natural_keys(text: str):
    return [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', text)]

def process_worker(args: Tuple[str, Path, Optional[str]]) -> Tuple[str, str, Optional[Dict[str, Any]]]:
    """
    args: (sutta_id, root_file_path, author_uid)
    """
    sutta_id, root_path, author_uid = args
    
    try:
        # 1. Xác định group (chỉ để trả về cho Manager gom nhóm)
        # (Logic get_group_name có thể tái sử dụng hoặc tính toán ở Manager)
        # Ở đây ta trả về None, Manager sẽ tự xử lý group map
        
        # 2. Tìm các file phụ trợ
        trans_path = get_file_path(sutta_id, "translation", author_uid) if author_uid else None
        html_path = get_file_path(sutta_id, "html")
        comment_path = get_file_path(sutta_id, "comment")

        # Skip nếu không có HTML (bắt buộc để hiển thị)
        if not html_path:
            return "skipped", sutta_id, None

        # 3. Load nội dung
        data_root = load_json(root_path)
        data_trans = load_json(trans_path)
        data_html = load_json(html_path)
        data_comment = load_json(comment_path)

        # 4. Trộn dữ liệu thành List
        all_keys = set(data_root.keys()) | set(data_html.keys())
        # Nếu có bản dịch thì lấy key bản dịch, nếu không thì thôi
        if data_trans:
            all_keys |= set(data_trans.keys())
            
        sorted_keys = sorted(list(all_keys), key=natural_keys)

        segments = [] # [NEW] List instead of Dict
        has_content = False
        
        for key in sorted_keys:
            pali = data_root.get(key)
            eng = data_trans.get(key)
            html = data_html.get(key)
            comm = data_comment.get(key)
            
            if not (pali or eng or html):
                continue

            has_content = True
            
            # Short keys
            entry = {"id": key} # [NEW] Cần ID trong object vì giờ là list
            if pali: entry["pli"] = pali
            if eng: entry["en"] = eng
            if html: entry["html"] = html
            if comm: entry["comm"] = comm
            
            segments.append(entry)

        if not has_content:
             return "skipped", sutta_id, None

        # 5. Kết quả
        final_data = {
            "author_uid": author_uid,
            "segments": segments
        }

        return "success", sutta_id, final_data

    except Exception as e:
        # logger.error(f"Error {sutta_id}: {e}")
        return "error", sutta_id, None