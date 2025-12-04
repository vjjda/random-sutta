# Path: src/release_system/logic/versioning.py
import logging
from datetime import datetime

logger = logging.getLogger("Release.Versioning")

def generate_version_tag() -> str:
    """
    Tạo version tag dựa trên timestamp hiện tại.
    Format: vYYYYMMDD-HHMMSS (Ví dụ: v20231025-143005)
    """
    now = datetime.now()
    # [CHANGED] Thêm %S để lấy giây
    tag = now.strftime("v%Y%m%d-%H%M%S")
    logger.info(f"🏷️  Generated Version Tag: {tag}")
    return tag