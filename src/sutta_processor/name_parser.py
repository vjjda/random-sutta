# Path: src/sutta_processor/name_parser.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, TypedDict, Optional

from .config import DATA_API_DIR

logger = logging.getLogger("SuttaProcessor")

# [UPDATE] Mở rộng Schema để chứa thông tin Branch
class SuttaNameInfo(TypedDict):
    acronym: str
    translated_title: str
    original_title: str
    blurb: Optional[str]
    type: str  # 'leaf' hoặc 'branch'

def load_names_map() -> Dict[str, SuttaNameInfo]:
    if not DATA_API_DIR.exists():
        logger.warning(f"⚠️ API Data directory not found: {DATA_API_DIR}")
        return {}

    logger.info("📚 Loading metadata into memory (Deep Scan)...")
    
    master_name_map: Dict[str, SuttaNameInfo] = {}
    json_files = sorted(list(DATA_API_DIR.rglob("*.json")))

    for file_path in json_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)

            if isinstance(raw_data, list):
                iterable = raw_data
            elif isinstance(raw_data, dict):
                iterable = [raw_data]
            else:
                continue

            for item in iterable:
                uid = item.get("uid")
                if not uid:
                    continue
                
                # [UPDATE] Lấy thêm blurb và type
                entry: SuttaNameInfo = {
                    "acronym": item.get("acronym") or "",
                    "translated_title": (item.get("translated_title") or "").strip(),
                    "original_title": (item.get("original_title") or "").strip(),
                    "blurb": item.get("blurb"),
                    "type": item.get("type", "leaf")
                }
                
                master_name_map[uid] = entry

        except Exception as e:
            logger.error(f"❌ Error reading API file {file_path.name}: {e}")

    logger.info(f"   -> Loaded metadata for {len(master_name_map)} items.")
    return master_name_map