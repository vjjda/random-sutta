# Path: src/release_system/logic/cleaner.py
import logging
import os
import shutil
from ..config import WEB_DIR

logger = logging.getLogger("Release.Cleaner")

def cleanup_artifacts() -> None:
    """Khôi phục môi trường Dev và xóa file tạm."""
    logger.info("🧹 Cleaning up artifacts...")
    
    # 1. Remove bundle
    bundle_path = WEB_DIR / "assets" / "app.bundle.js"
    if bundle_path.exists():
        os.remove(bundle_path)
        
    # 2. Restore HTML
    index_path = WEB_DIR / "index.html"
    backup_path = index_path.with_name("index.html.bak")
    if backup_path.exists():
        shutil.move(backup_path, index_path)
        logger.info("   ✅ Restored index.html to dev mode.")