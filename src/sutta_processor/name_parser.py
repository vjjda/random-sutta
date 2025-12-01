# Path: src/sutta_processor/name_parser.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, TypedDict

from .config import DATA_API_DIR

logger = logging.getLogger("SuttaProcessor")

# Định nghĩa kiểu dữ liệu cho rõ ràng (Type Hinting)
class SuttaNameInfo(TypedDict):
    acronym: str
    translated_title: str
    original_title: str

def load_names_map() -> Dict[str, SuttaNameInfo]:
    """
    Đọc toàn bộ file JSON metadata và trả về một Dictionary khổng lồ.
    Không còn logic viết file (IO) ở đây nữa.
    """
    if not DATA_API_DIR.exists():
        logger.warning(f"⚠️ API Data directory not found: {DATA_API_DIR}")
        return {}

    logger.info("📚 Loading metadata into memory...")
    
    master_name_map: Dict[str, SuttaNameInfo] = {}
    json_files = sorted(list(DATA_API_DIR.glob("*.json")))

    for file_path in json_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                raw_list = json.load(f)

            if isinstance(raw_list, list):
                for item in raw_list:
                    uid = item.get("uid")
                    if not uid:
                        continue
                    
                    # Chuẩn hóa dữ liệu
                    entry: SuttaNameInfo = {
                        "acronym": item.get("acronym") or "",
                        "translated_title": (item.get("translated_title") or "").strip(),
                        "original_title": (item.get("original_title") or "").strip()
                    }
                    
                    master_name_map[uid] = entry

        except Exception as e:
            logger.error(f"❌ Error reading API file {file_path.name}: {e}")

    logger.info(f"   -> Loaded {len(master_name_map)} name entries.")
    return master_name_map