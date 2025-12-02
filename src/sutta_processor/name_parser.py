# Path: src/sutta_processor/name_parser.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, TypedDict

from .config import DATA_API_DIR

logger = logging.getLogger("SuttaProcessor")

class SuttaNameInfo(TypedDict):
    acronym: str
    translated_title: str
    original_title: str

def load_names_map() -> Dict[str, SuttaNameInfo]:
    """
    Đọc toàn bộ file JSON metadata từ data/json (bao gồm cả thư mục con)
    và trả về Dictionary map: uid -> thông tin tên.
    """
    if not DATA_API_DIR.exists():
        logger.warning(f"⚠️ API Data directory not found: {DATA_API_DIR}")
        return {}

    logger.info("📚 Loading metadata into memory (Deep Scan)...")
    
    master_name_map: Dict[str, SuttaNameInfo] = {}
    
    # [FIX] Dùng rglob thay vì glob để quét các folder con (sutta/kn, vinaya...)
    json_files = sorted(list(DATA_API_DIR.rglob("*.json")))

    for file_path in json_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)

            # API SuttaCentral trả về list các suttaplex object hoặc 1 object (root)
            # Tuy nhiên file metadata mình tải về thường là List (như sample mn.json bạn gửi)
            if isinstance(raw_data, list):
                iterable = raw_data
            elif isinstance(raw_data, dict):
                # Trường hợp file json root (ít gặp với cách fetch hiện tại nhưng phòng hờ)
                iterable = [raw_data]
            else:
                continue

            for item in iterable:
                uid = item.get("uid")
                if not uid:
                    continue
                
                # Trích xuất metadata quan trọng
                entry: SuttaNameInfo = {
                    "acronym": item.get("acronym") or "",
                    "translated_title": (item.get("translated_title") or "").strip(),
                    "original_title": (item.get("original_title") or "").strip()
                }
                
                master_name_map[uid] = entry

        except Exception as e:
            logger.error(f"❌ Error reading API file {file_path.name}: {e}")

    logger.info(f"   -> Loaded metadata for {len(master_name_map)} suttas.")
    return master_name_map