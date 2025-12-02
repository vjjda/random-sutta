# Path: src/sutta_processor/converter.py
import json
import re
import logging
from pathlib import Path
from typing import Dict, Optional, Tuple, Any, List

from .config import DATA_ROOT

logger = logging.getLogger("SuttaProcessor")

# Thứ tự ưu tiên dịch giả (Hardcoded Priority)
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
    """
    Tìm file dịch tiếng Anh dựa trên độ ưu tiên tác giả.
    Trả về: (Path đến file, Author UID)
    """
    base_trans_dir = DATA_ROOT / "translation" / "en"
    
    if not base_trans_dir.exists():
        return None, ""

    for author in TRANSLATOR_PRIORITY:
        author_dir = base_trans_dir / author
        if not author_dir.exists():
            continue
            
        # Tìm đệ quy trong folder của tác giả (vì có thể nằm trong sutta/kn/..., vinaya/...)
        # Pattern: {sutta_id}_translation-en-*.json
        pattern = f"{sutta_id}_translation-en-*.json"
        
        # rglob trả về generator, lấy file đầu tiên tìm thấy
        found = list(author_dir.rglob(pattern))
        
        if found:
            # Ưu tiên sujato > brahmali > kelly
            return found[0], author

    return None, ""

def find_auxiliary_file(sutta_id: str, category: str) -> Optional[Path]:
    """Tìm các file phụ trợ (html, comment) bằng cách quét deep."""
    base_dir = DATA_ROOT / category
    if not base_dir.exists():
        return None
        
    # Pattern ví dụ: mn4_html.json hoặc mn4_comment-en-*.json
    if category == "html":
        pattern = f"{sutta_id}_html.json"
    elif category == "comment":
        pattern = f"{sutta_id}_comment-en-*.json"
    else:
        return None

    found = list(base_dir.rglob(pattern))
    return found[0] if found else None

def get_group_name(root_file_path: Path) -> str:
    """Xác định group (book) từ đường dẫn file root. Ví dụ: 'mn', 'kn/dhp'."""
    try:
        # Đường dẫn chuẩn: .../data/bilara/root/sutta/mn/mn1_...
        # Hoặc: .../data/bilara/root/sutta/kn/dhp/dhp1_...
        
        # Lấy phần tương đối từ folder 'root'
        base_root = DATA_ROOT / "root"
        rel_path = root_file_path.relative_to(base_root)
        
        parts = rel_path.parts
        
        # Cấu trúc: sutta/mn/... -> group = mn
        # Cấu trúc: sutta/kn/dhp/... -> group = kn/dhp
        # Cấu trúc: vinaya/pli-tv-bi-vb/... -> group = pli-tv-bi-vb
        
        if len(parts) >= 2:
            if parts[0] == 'sutta':
                if parts[1] == 'kn' and len(parts) > 2:
                    return f"kn/{parts[2]}"
                return parts[1]
            if parts[0] == 'vinaya' and len(parts) > 1:
                return parts[1]
            if parts[0] == 'abhidhamma' and len(parts) > 1:
                return parts[1]
                
        return "uncategorized"
            
    except ValueError:
        return "uncategorized"

def natural_keys(text: str):
    """Sort keys helper (mn1:1.1, mn1:1.2...)"""
    return [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', text)]

def process_worker(args: Tuple[str, Path]) -> Tuple[str, str, Optional[Dict[str, Any]]]:
    sutta_id, root_file_path = args
    
    try:
        # 1. Định danh Group
        group = get_group_name(root_file_path)

        # 2. Tìm các file liên quan
        trans_path, author_uid = find_translation_file(sutta_id)
        html_path = find_auxiliary_file(sutta_id, "html")
        comment_path = find_auxiliary_file(sutta_id, "comment") # Thường là Sujato

        # Nếu không có file html, coi như lỗi (vì không biết render kiểu gì)
        # Nếu không có translation, vẫn chấp nhận (chỉ hiện Pali)
        if not html_path:
            return "skipped", sutta_id, None

        # 3. Load nội dung
        data_root = load_json(root_file_path)
        data_trans = load_json(trans_path)
        data_html = load_json(html_path)
        data_comment = load_json(comment_path)

        # 4. Trộn dữ liệu (Merge)
        # Lấy tập hợp tất cả các keys (segment ids)
        all_keys = set(data_root.keys()) | set(data_html.keys()) | set(data_trans.keys())
        sorted_keys = sorted(list(all_keys), key=natural_keys)

        segments = {}
        
        for key in sorted_keys:
            # Chỉ lấy những segment có nội dung (HTML, Pali hoặc Anh)
            pali = data_root.get(key)
            eng = data_trans.get(key)
            html = data_html.get(key)
            comm = data_comment.get(key)
            
            if not (pali or eng or html):
                continue

            # Short Keys cho Raw Data
            entry = {}
            if pali: entry["p"] = pali
            if eng: entry["e"] = eng
            if html: entry["h"] = html # Template string: <p>{}</p>
            if comm: entry["c"] = comm
            
            # Key rút gọn: mn4:1.1 -> 1.1 để tiết kiệm dung lượng JSON
            # App JS sẽ tự nối lại ID dựa trên Sutta ID
            short_key = key.split(":")[-1] if ":" in key else key
            
            segments[short_key] = entry

        # 5. Kết quả
        final_data = {
            "author_uid": author_uid,
            "segments": segments
        }

        return group, sutta_id, final_data

    except Exception as e:
        logger.error(f"❌ Error merging {sutta_id}: {e}")
        return "error", sutta_id, None