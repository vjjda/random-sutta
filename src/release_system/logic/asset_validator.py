# Path: src/release_system/logic/asset_validator.py
import logging
from pathlib import Path
from typing import List

from ..release_config import WEB_DIR # [UPDATED] Import

logger = logging.getLogger("Release.AssetValidator")

def check_critical_assets(asset_list: List[str]) -> bool:
    logger.info("🔍 Checking critical assets...")
    missing = []
    for rel_path in asset_list:
        full_path = WEB_DIR / rel_path
        if not full_path.exists():
            missing.append(rel_path)
    
    if missing:
        logger.error(f"❌ FATAL: Missing source files: {missing}")
        return False
    return True