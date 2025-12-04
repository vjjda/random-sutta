# Path: src/release_system/logic/build_preparer.py
import logging
import shutil
import os
from ..release_config import WEB_DIR, BUILD_DIR

logger = logging.getLogger("Release.Preparer")

def prepare_build_directory() -> bool:
    """
    Copy toàn bộ nội dung từ web/ sang build/ để xử lý an toàn.
    """
    logger.info("sandbox 📦 Creating build sandbox...")
    
    # 1. Clean old build
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    
    try:
        # 2. Copy Source to Sandbox
        # ignore các file không cần thiết cho bản build cuối cùng (như file map, file ẩn)
        shutil.copytree(
            WEB_DIR, 
            BUILD_DIR,
            ignore=shutil.ignore_patterns("*.map", ".DS_Store", "Thumbs.db")
        )
        logger.info(f"   ✅ Copied source to {BUILD_DIR}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to prepare build directory: {e}")
        return False