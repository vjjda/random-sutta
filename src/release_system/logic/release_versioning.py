# Path: src/release_system/logic/release_versioning.py
import logging
from datetime import datetime

logger = logging.getLogger("Release.Versioning")

def generate_version_tag() -> str:
    """
    Tạo version tag tự động.
    Format cũ: v20251205-182515
    Format mới: v2025.12.05-18.25.15
    """
    now = datetime.now()
    # [UPDATED] Thêm dấu chấm phân cách
    tag = now.strftime("v%Y.%m.%d-%H.%M.%S")
    logger.info(f"🏷️  Generated Version Tag: {tag}")
    return tag