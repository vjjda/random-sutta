# Path: src/release_system/logic/validator.py
import logging
from pathlib import Path
from typing import List

from ..config import WEB_DIR

logger = logging.getLogger("Release.Validator")

def check_critical_assets(asset_list: List[str]) -> bool:
    """Kiểm tra sự tồn tại của các file nguồn quan trọng."""
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