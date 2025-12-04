# Path: src/release_system/logic/content_modifier.py
import logging
import shutil
import re
from pathlib import Path

from ..config import WEB_DIR

logger = logging.getLogger("Release.ContentMod")

def _update_file_content(file_path: Path, pattern: str, replacement: str) -> bool:
    if not file_path.exists(): return False
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        new_content = re.sub(pattern, replacement, content)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True
    except Exception as e:
        logger.error(f"❌ Error updating {file_path.name}: {e}")
        return False

def prepare_html_for_release(version_tag: str) -> bool:
    """
    Backup và sửa index.html để trỏ tới bundle và thêm version param.
    """
    logger.info("📝 Updating index.html for release...")
    index_path = WEB_DIR / "index.html"
    
    # Backup
    shutil.copy(index_path, str(index_path) + ".bak")
    
    # 1. Switch to bundle
    success = _update_file_content(
        index_path,
        r'<script type="module" src="assets/app.js.*"></script>',
        f'<script src="assets/app.bundle.js?v={version_tag}"></script>'
    )
    if not success: return False

    # 2. Update assets versioning
    _update_file_content(
        index_path,
        r'(assets\/.*?\.(?:css|js))(?:\?v=[^"\']*)?',
        f'\\1?v={version_tag}'
    )
    
    return True

def update_service_worker(version_tag: str) -> None:
    """Cập nhật Cache Name trong Service Worker."""
    sw_path = WEB_DIR / "sw.js"
    _update_file_content(
        sw_path,
        r'const CACHE_NAME\s*=\s*["\'].*?["\'];', 
        f'const CACHE_NAME = "sutta-cache-{version_tag}";'
    )
    logger.info(f"   🔄 Updated SW Cache Name: {version_tag}")