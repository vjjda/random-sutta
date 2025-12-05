# Path: src/release_system/logic/build_preparer.py
import logging
import shutil
from pathlib import Path
from ..release_config import WEB_DIR

logger = logging.getLogger("Release.Preparer")

def prepare_build_directory(target_dir: Path) -> bool:
    """
    Copy toàn bộ nội dung từ web/ sang target_dir.
    """
    logger.info(f"sandbox 📦 Creating sandbox: {target_dir.name}...")
    
    # 1. Clean old build
    if target_dir.exists():
        shutil.rmtree(target_dir)
    
    try:
        # 2. Copy Source -> Target
        shutil.copytree(
            WEB_DIR, 
            target_dir,
            ignore=shutil.ignore_patterns("*.map", ".DS_Store", ".git")
        )
        logger.info(f"   ✅ Copied source to {target_dir.name}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to prepare build directory: {e}")
        return False