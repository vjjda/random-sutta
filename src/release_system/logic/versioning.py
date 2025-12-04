# Path: src/release_system/logic/versioning.py
import logging
from datetime import datetime

logger = logging.getLogger("Release.Versioning")

def generate_version_tag() -> str:
    """
    Tạo version tag dựa trên timestamp hiện tại.
    Format: vYYYYMMDD-HHMM (Ví dụ: v20231025-1430)
    """
    now = datetime.now()
    tag = now.strftime("v%Y%m%d-%H%M")
    logger.info(f"🏷️  Generated Version Tag: {tag}")
    return tag