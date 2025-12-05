# Path: src/release_system/logic/web_content_modifier.py
import logging
import re
from pathlib import Path

logger = logging.getLogger("Release.WebContentMod")

def _update_file(file_path: Path, pattern: str, replacement: str) -> bool:
    if not file_path.exists(): return False
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        new_content = re.sub(pattern, replacement, content, count=1)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True
    except Exception as e:
        logger.error(f"❌ Error updating {file_path.name}: {e}")
        return False

def inject_version_into_sw(target_dir: Path, version_tag: str) -> bool:
    """Tiêm version tag vào sw.js."""
    logger.info(f"💉 Injecting cache version '{version_tag}' into {target_dir.name}/sw.js...")
    sw_path = target_dir / "sw.js"
    return _update_file(
        sw_path,
        r'const CACHE_NAME\s*=\s*["\'].*?["\'];', 
        f'const CACHE_NAME = "sutta-cache-{version_tag}";'
    )

def _patch_css_link(index_path: Path, version_tag: str) -> bool:
    """Chuyển đổi style.css thành style.bundle.css."""
    return _update_file(
        index_path,
        r'<link rel="stylesheet" href="assets/style\.css.*?"\s*/>',
        f'<link rel="stylesheet" href="assets/style.bundle.css?v={version_tag}" />'
    )

def patch_online_html(build_dir: Path, version_tag: str) -> bool:
    """
    Online Mode:
    - CSS: Bundle.
    - JS: Giữ nguyên ESM (app.js) nhưng thêm version param để burst cache.
    """
    logger.info("📝 Patching index.html (Online Mode)...")
    index_path = build_dir / "index.html"
    
    # 1. Patch CSS -> Bundle
    css_ok = _patch_css_link(index_path, version_tag)

    # 2. Patch JS -> Giữ app.js, thêm version
    # Tìm: src="assets/app.js" -> src="assets/app.js?v=..."
    js_ok = _update_file(
        index_path,
        r'src="assets/app\.js.*?"',
        f'src="assets/app.js?v={version_tag}"'
    )

    return css_ok and js_ok

def patch_offline_html(build_dir: Path, version_tag: str) -> bool:
    """
    Offline Mode:
    - CSS: Bundle.
    - JS: Bundle (app.bundle.js), xóa type="module", thêm defer.
    """
    logger.info("📝 Patching index.html (Offline Mode)...")
    index_path = build_dir / "index.html"
    
    # 1. Patch CSS -> Bundle
    css_ok = _patch_css_link(index_path, version_tag)

    # 2. Patch JS -> Bundle IIFE
    js_ok = _update_file(
        index_path,
        r'<script type="module" src="assets/app\.js.*?"></script>',
        f'<script defer src="assets/app.bundle.js?v={version_tag}"></script>'
    )
    
    return css_ok and js_ok