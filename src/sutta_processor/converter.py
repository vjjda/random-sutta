# Path: src/sutta_processor/converter.py
import json
import re
import logging
from pathlib import Path
from typing import Dict, Optional, Tuple, Any, List

from .config import DATA_ROOT

logger = logging.getLogger("SuttaProcessor")

# Thứ tự ưu tiên dịch giả
TRANSLATOR_PRIORITY = ["sujato", "brahmali", "kelly"]

def load_json(path: Path) -> Dict[str, str]:
    if not path or not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"⚠️ Error reading {path.name}: {e}")
        return {}

def find_translation_file(sutta_id: str) -> Tuple[Optional[Path], str]:
    """Tìm file dịch tiếng Anh dựa trên độ ưu tiên tác giả."""
    base_trans_dir = DATA_ROOT / "translation" / "en"
    if not base_trans_dir.exists():
        return None, ""

    for author in TRANSLATOR_PRIORITY:
        author_dir = base_trans_dir / author
        if not author_dir.exists():
            continue
            
        pattern = f"{sutta_id}_translation-en-*.json"
        found = list(author_dir.rglob(pattern))
        if found:
            return found[0], author
    return None, ""

def find_auxiliary_file(sutta_id: str, category: str) -> Optional[Path]:
    """Tìm các file phụ trợ (html, comment)."""
    base_dir = DATA_ROOT / category
    if not base_dir.exists():
        return None
        
    if category == "html":
        pattern = f"{sutta_id}_html.json"
    elif category == "comment":
        pattern = f"{sutta_id}_comment-en-*.json"
    else:
        return None

    found = list(base_dir.rglob(pattern))
    return found[0] if found else None

def get_group_name(root_file_path: Path) -> str:
    """
    Xác định group chuẩn xác từ đường dẫn file root.
    Hỗ trợ cả file nằm sâu trong folder con và file lẻ nằm ngay root category.
    """
    try:
        base_root = DATA_ROOT / "root"
        rel_path = root_file_path.relative_to(base_root)
        parts = rel_path.parts
        
        if not parts:
            return "uncategorized"

        category = parts[0]
        
        # Trường hợp 1: File nằm trong folder con (Deep structure)
        # Ví dụ: vinaya/pli-tv-bi-vb/pli-tv-bi-vb-np/...
        if len(parts) > 1:
            # Sutta/KN đặc biệt vì có thêm 1 cấp
            if category == 'sutta':
                if parts[1] == 'kn':
                    if len(parts) > 2:
                        return f"sutta/kn/{parts[2]}"
                    # Nếu file nằm ngay trong sutta/kn (hiếm gặp nhưng có thể)
                    return f"sutta/kn/{root_file_path.name.split('_')[0]}"
                return f"sutta/{parts[1]}"
            
            # Vinaya/Abhidhamma: Lấy folder cấp 1 làm group
            # Tuy nhiên, nếu file nằm ngay trong vinaya/ (len=2, parts[1] là file)
            # Thì phải lấy tên file làm group ID
            if root_file_path.is_file() and len(parts) == 2:
                 # Ví dụ: vinaya/pli-tv-bi-pm_root-pli-ms.json
                 # Lấy prefix trước dấu _ đầu tiên làm group ID
                 book_id = parts[1].split('_')[0]
                 return f"{category}/{book_id}"

            # Trường hợp folder con chuẩn: vinaya/pli-tv-bi-vb/file.json
            return f"{category}/{parts[1]}"
            
        return "uncategorized"
            
    except ValueError:
        return "uncategorized"

def natural_keys(text: str):
    return [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', text)]

def process_worker(args: Tuple[str, Path]) -> Tuple[str, str, Optional[Dict[str, Any]]]:
    sutta_id, root_file_path = args
    
    try:
        # 1. Định danh Group
        group = get_group_name(root_file_path)

        # 2. Tìm các file liên quan
        trans_path, author_uid = find_translation_file(sutta_id)
        html_path = find_auxiliary_file(sutta_id, "html")
        comment_path = find_auxiliary_file(sutta_id, "comment")

        # Skip nếu không có HTML (trừ khi bạn muốn giữ raw text không format)
        if not html_path:
            # Vẫn trả về group đúng để Manager update progress, nhưng content là None
            return group, sutta_id, None

        # 3. Load nội dung
        data_root = load_json(root_file_path)
        data_trans = load_json(trans_path)
        data_html = load_json(html_path)
        data_comment = load_json(comment_path)

        # 4. Trộn dữ liệu
        all_keys = set(data_root.keys()) | set(data_html.keys()) | set(data_trans.keys())
        sorted_keys = sorted(list(all_keys), key=natural_keys)

        segments = {}
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
            if pali: entry["p"] = pali
            if eng: entry["e"] = eng
            if html: entry["h"] = html
            if comm: entry["c"] = comm
            
            short_key = key.split(":")[-1] if ":" in key else key
            segments[short_key] = entry

        if not has_content:
             return group, sutta_id, None

        # 5. Kết quả
        final_data = {
            "author_uid": author_uid,
            "segments": segments
        }

        return group, sutta_id, final_data

    except Exception as e:
        logger.error(f"❌ Error merging {sutta_id}: {e}")
        return "error_group", sutta_id, None