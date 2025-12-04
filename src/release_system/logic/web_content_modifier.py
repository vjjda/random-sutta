# Path: src/release_system/logic/web_content_modifier.py
import logging
import re
from pathlib import Path

from ..release_config import WEB_DIR

logger = logging.getLogger("Release.WebContentMod")

def _update_file(file_path: Path, pattern: str, replacement: str) -> bool:
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

def update_source_version(version_tag: str) -> bool:
    """
    [PERSISTENT] Cập nhật version trong Source Code (web/) để commit.
    """
    logger.info("📝 Bumping version in source code...")
    sw_path = WEB_DIR / "sw.js"
    
    return _update_file(
        sw_path,
        r'const CACHE_NAME\s*=\s*["\'].*?["\'];', 
        f'const CACHE_NAME = "sutta-cache-{version_tag}";'
    )

def patch_build_html(build_dir: Path, version_tag: str) -> bool:
    """
    [TEMPORARY] Sửa index.html trong thư mục BUILD để dùng bundle.
    """
    logger.info("📝 Patching index.html in build sandbox...")
    index_path = build_dir / "index.html"
    
    # 1. Thay module app.js bằng bundle
    success = _update_file(
        index_path,
        r'<script type="module" src="assets/app.js.*"></script>',
        f'<script src="assets/app.bundle.js?v={version_tag}"></script>'
    )
    
    if success:
        # 2. Gắn version vào css/js khác
        _update_file(
            index_path,
            r'(assets\/.*?\.(?:css|js))(?:\?v=[^"\']*)?',
            f'\\1?v={version_tag}'
        )
    return success