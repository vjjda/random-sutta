# Path: src/sutta_processor/ingestion/fix_loader.py
import csv
import logging
from pathlib import Path
from typing import Dict, Tuple, TypedDict, Optional

from ..shared.app_config import MISSING_LINKS_FIX_FILE

logger = logging.getLogger("SuttaProcessor.Ingestion.FixLoader")

class FixEntry(TypedDict):
    target_uid: str
    hash_id: str
    anchor_text: Optional[str]

# Key: (sutta_id, segment_id, original_url) -> Value: FixEntry
FixMap = Dict[Tuple[str, str, str], FixEntry]

def load_fix_map() -> FixMap:
    """
    Đọc file TSV fix và trả về map tra cứu.
    Key tra cứu chính xác là: (Sutta đang xử lý, Segment đang xử lý, Link gốc bị lỗi).
    """
    if not MISSING_LINKS_FIX_FILE.exists():
        logger.warning(f"⚠️ Fix file not found at {MISSING_LINKS_FIX_FILE}. Skipping fixes.")
        return {}

    fix_map: FixMap = {}
    count = 0

    try:
        with open(MISSING_LINKS_FIX_FILE, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")
            
            for row in reader:
                # Lấy key nhận diện
                sutta = row.get("sutta", "").strip()
                segment = row.get("segment", "").strip()
                mentioned = row.get("mentioned", "").strip() # URL gốc
                
                # Lấy value fix
                # Lưu ý: Tên cột phải khớp với file TSV bạn cung cấp
                # "anchor_text_fixed", "miss_uid_fixed", "hash_id_fixed"
                uid_fixed = row.get("miss_uid_fixed", "").strip()
                
                # Chỉ xử lý nếu có UID fix
                if sutta and segment and mentioned and uid_fixed:
                    fix_entry: FixEntry = {
                        "target_uid": uid_fixed.lower(),
                        "hash_id": row.get("hash_id_fixed", "").strip(),
                        "anchor_text": row.get("anchor_text_fixed", "").strip() or None
                    }
                    
                    fix_map[(sutta, segment, mentioned)] = fix_entry
                    count += 1
                    
        logger.info(f"   🔧 Loaded {count} link fixes from TSV.")
        return fix_map

    except Exception as e:
        logger.error(f"❌ Failed to load fix file: {e}")
        return {}