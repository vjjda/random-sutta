# Path: src/release_system/logic/build_preparer.py
import logging
import shutil
from pathlib import Path
from ..release_config import WEB_DIR

logger = logging.getLogger("Release.Preparer")

def prepare_build_directory(target_dir: Path) -> bool:
    """
    Copy toàn bộ nội dung từ web/ sang target_dir.
    Tự động loại bỏ các thư mục rác hoặc legacy.
    """
    logger.info(f"sandbox 📦 Creating sandbox: {target_dir.name}...")
    
    # 1. Clean old build
    if target_dir.exists():
        shutil.rmtree(target_dir)
    
    try:
        # [UPDATED] Ignore patterns:
        # - *.map: Source map (không cần cho prod)
        # - .DS_Store, .git: File hệ thống
        # - assets/books: Database cũ (Monolithic) -> Loại bỏ để tiết kiệm dung lượng
        # - assets/modules/data/file_index.js: File index cũ (nếu còn sót)
        ignore_patterns = shutil.ignore_patterns(
            "*.map", 
            ".DS_Store", 
            ".git",
            "books",       # Ignored folder inside assets/
            "file_index.js" # Ignored file
        )

        # 2. Copy Source -> Target
        shutil.copytree(
            WEB_DIR, 
            target_dir,
            ignore=ignore_patterns
        )
        logger.info(f"   ✅ Copied source to {target_dir.name} (Cleaned legacy data)")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to prepare build directory: {e}")
        return False