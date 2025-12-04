# Path: src/release_system/logic/build_cleanup.py
import logging
import os
import shutil
from ..release_config import WEB_DIR # [UPDATED] Import

logger = logging.getLogger("Release.BuildCleanup")

def cleanup_artifacts() -> None:
    logger.info("🧹 Cleaning up artifacts...")
    bundle_path = WEB_DIR / "assets" / "app.bundle.js"
    if bundle_path.exists():
        os.remove(bundle_path)
        
    index_path = WEB_DIR / "index.html"
    backup_path = index_path.with_name("index.html.bak")
    if backup_path.exists():
        shutil.move(backup_path, index_path)
        logger.info("   ✅ Restored index.html to dev mode.")