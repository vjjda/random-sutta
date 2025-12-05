# Path: src/sutta_processor/ingestion/metadata_parser.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..shared.app_config import DATA_API_DIR, AUTHOR_PRIORITY
from ..shared.domain_types import SuttaMeta

logger = logging.getLogger("SuttaProcessor.Ingestion.Meta")

def _find_best_author(translations: List[Dict[str, Any]]) -> Optional[str]:
    """Tìm tác giả phù hợp nhất từ danh sách translations."""
    if not translations:
        return None
        
    valid_trans = {
        t.get("author_uid"): t 
        for t in translations 
        if t.get("lang") == "en" and t.get("segmented") is True
    }
    
    for author in AUTHOR_PRIORITY:
        if author in valid_trans:
            return author
            
    return None

def load_names_map() -> Dict[str, SuttaMeta]:
    """Quét toàn bộ metadata, trích xuất thông tin cơ bản."""
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
                
                translations = item.get("translations", [])
                best_author = _find_best_author(translations)
                
                # --- [LOGIC QUAN TRỌNG: Lọc Scroll Target] ---
                raw_scroll_target = item.get("scroll_target")
                parent_uid = item.get("parent_uid")
                final_scroll_target = raw_scroll_target
                
                # Nếu target trùng với container (parent), thì KHÔNG scroll
                if raw_scroll_target == parent_uid:
                    final_scroll_target = None
                # ---------------------------------------------
                
                entry: SuttaMeta = {
                    "uid": uid,
                    "type": item.get("type", "leaf"),
                    "acronym": item.get("acronym") or "",
                    "translated_title": (item.get("translated_title") or "").strip(),
                    "original_title": (item.get("original_title") or "").strip(),
                    "blurb": item.get("blurb"),
                    "best_author_uid": best_author,
                    "author_uid": None, # Sẽ được update khi merge content
                    
                    # Lưu giá trị đã xử lý vào đây
                    "scroll_target": final_scroll_target 
                }
                
                meta_map[uid] = entry

        except Exception as e:
            logger.error(f"❌ Error reading {file_path.name}: {e}")

    logger.info(f"   -> Loaded metadata for {len(meta_map)} items.")
    return meta_map