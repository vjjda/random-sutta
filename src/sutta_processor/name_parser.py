# Path: src/sutta_processor/name_parser.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, TypedDict, Optional, List

from .config import DATA_API_DIR, AUTHOR_PRIORITY

logger = logging.getLogger("SuttaProcessor")

class SuttaMeta(TypedDict):
    uid: str
    type: str  # 'leaf' | 'branch'
    acronym: str
    translated_title: str
    original_title: str
    blurb: Optional[str]
    best_author_uid: Optional[str] # Dịch giả được chọn (nếu có)

def _find_best_author(translations: List[Dict[str, Any]]) -> Optional[str]:
    """
    Tìm tác giả phù hợp nhất từ danh sách translations trong metadata.
    Tiêu chí: lang='en', segmented=True, author_uid nằm trong priority list.
    """
    if not translations:
        return None
        
    # Tạo map để tra cứu nhanh: author_uid -> translation_entry
    # Chỉ lấy các bản dịch tiếng Anh và có segmented
    valid_trans = {
        t.get("author_uid"): t 
        for t in translations 
        if t.get("lang") == "en" and t.get("segmented") is True
    }
    
    # Check theo thứ tự ưu tiên
    for author in AUTHOR_PRIORITY:
        if author in valid_trans:
            return author
            
    return None

def load_names_map() -> Dict[str, SuttaMeta]:
    """
    Quét toàn bộ metadata, trích xuất thông tin cơ bản và xác định dịch giả.
    """
    if not DATA_API_DIR.exists():
        logger.warning(f"⚠️ API Data directory not found: {DATA_API_DIR}")
        return {}

    logger.info("📚 Parsing metadata & resolving authors...")
    
    meta_map: Dict[str, SuttaMeta] = {}
    json_files = sorted(list(DATA_API_DIR.rglob("*.json")))

    for file_path in json_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)

            iterable = raw_data if isinstance(raw_data, list) else [raw_data]

            for item in iterable:
                uid = item.get("uid")
                if not uid: continue
                
                # Logic xác định dịch giả ngay tại đây
                translations = item.get("translations", [])
                best_author = _find_best_author(translations)
                
                entry: SuttaMeta = {
                    "uid": uid,
                    "type": item.get("type", "leaf"),
                    "acronym": item.get("acronym") or "",
                    "translated_title": (item.get("translated_title") or "").strip(),
                    "original_title": (item.get("original_title") or "").strip(),
                    "blurb": item.get("blurb"),
                    "best_author_uid": best_author
                }
                
                meta_map[uid] = entry

        except Exception as e:
            logger.error(f"❌ Error reading {file_path.name}: {e}")

    logger.info(f"   -> Loaded metadata for {len(meta_map)} items.")
    return meta_map