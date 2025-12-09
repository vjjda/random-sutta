# Path: src/release_system/logic/web_content_modifier.py
import logging
import shutil
from pathlib import Path

logger = logging.getLogger("Release.WebContentMod")

def remove_db_bundle(build_dir: Path) -> bool:
    """
    Xóa file db_bundle.zip khỏi thư mục build.
    Dùng cho bản Offline vì bản này dùng file .js rời, không cần zip.
    """
    zip_path = build_dir / "assets" / "db" / "db_bundle.zip"
    
    if zip_path.exists():
        try:
            zip_path.unlink()
            logger.info(f"   🧹 Removed redundant db_bundle.zip from {build_dir.name}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to remove db_bundle.zip: {e}")
            return False
            
    return True

def remove_redundant_index(build_dir: Path) -> bool:
    """
    [NEW] Xóa thư mục index/ (Split Index) trong bản Offline Build.
    Vì bản Offline đã dùng db_index.js (global variable) nên không cần các file json nhỏ lẻ.
    """
    index_dir = build_dir / "assets" / "db" / "index"
    if index_dir.exists():
        try:
            shutil.rmtree(index_dir)
            logger.info(f"   🧹 Removed redundant index directory from {build_dir.name}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to remove index dir: {e}")
            return False
    return True

def remove_monolithic_index(build_dir: Path) -> bool:
    """
    [NEW] Xóa uid_index.json khỏi bản build (Online).
    Vì bản Online dùng Split Index (Lazy Load), file này là dư thừa.
    """
    index_path = build_dir / "assets" / "db" / "uid_index.json"
    if index_path.exists():
        try:
            index_path.unlink()
            logger.info(f"   🧹 Removed redundant uid_index.json from {build_dir.name}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to remove uid_index.json: {e}")
            return False
    return True
