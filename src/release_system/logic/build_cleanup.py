# Path: src/release_system/logic/build_cleanup.py
import logging
import shutil
from ..release_config import BUILD_DIR

logger = logging.getLogger("Release.Cleanup")

def remove_build_dir() -> None:
    if BUILD_DIR.exists():
        logger.info("🧹 Removing build sandbox...")
        shutil.rmtree(BUILD_DIR)