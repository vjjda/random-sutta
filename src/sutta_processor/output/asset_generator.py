# Path: src/sutta_processor/output/asset_generator.py
import json
import logging
from pathlib import Path
from typing import Dict, Any

# [UPDATED]
from ..shared.app_config import STAGE_PROCESSED_DIR

logger = logging.getLogger("SuttaProcessor.Output.Generator")

def _ensure_dir(path: Path) -> None:
    if not path.parent.exists():
        path.parent.mkdir(parents=True, exist_ok=True)

def write_book_file(
    group_name: str, 
    book_content: Dict[str, Any], 
    dry_run: bool = False
) -> str:
    """
    Ghi file JSON đã xử lý vào STAGE_PROCESSED_DIR.
    """
    # [UPDATED]
    json_path = STAGE_PROCESSED_DIR / f"{group_name}_book.json"
    _ensure_dir(json_path)
    
    try:
        json_str_pretty = json.dumps(book_content, ensure_ascii=False, indent=2)
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(json_str_pretty)
            
        return json_path.name

    except Exception as e:
        logger.error(f"❌ Failed to write JSON {json_path.name}: {e}")
        return ""

# Các hàm legacy (write_loader_script, update_service_worker) 
# có thể được giữ lại hoặc xóa bỏ tùy vào việc bạn có muốn hỗ trợ cơ chế cũ không.
# Với kiến trúc mới (DBOptimizer), các hàm này không còn được gọi từ BuildManager nữa.