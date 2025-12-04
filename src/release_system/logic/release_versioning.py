# Path: src/release_system/logic/release_versioning.py
import logging
from datetime import datetime

logger = logging.getLogger("Release.Versioning")

def generate_version_tag() -> str:
    """Tạo version tag vYYYYMMDD-HHMMSS."""
    now = datetime.now()
    tag = now.strftime("v%Y%m%d-%H%M%S")
    logger.info(f"🏷️  Generated Version Tag: {tag}")
    return tag