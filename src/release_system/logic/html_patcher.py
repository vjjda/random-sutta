# Path: src/release_system/logic/html_patcher.py
import logging
import re
from pathlib import Path
from ..release_config import VERSION_PLACEHOLDER

logger = logging.getLogger("Release.HtmlPatcher")

def _update_file(file_path: Path, pattern: str, replacement: str) -> bool:
    # Tái sử dụng logic update file (có thể tách ra utils nếu cần)
    if not file_path.exists():
        logger.warning(f"⚠️ File not found: {file_path}")
        return False
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        if not re.search(pattern, content, flags=re.DOTALL):
            logger.warning(f"⚠️ Pattern '{pattern}' not found in {file_path.name}")
            return False

        new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True
    except Exception as e:
        logger.error(f"❌ Error updating {file_path.name}: {e}")
        return False

def _patch_html_assets(index_path: Path, version_tag: str, is_offline: bool) -> bool:
    # 1. Version Param
    common_pattern = rf'\?v={re.escape(VERSION_PLACEHOLDER)}'
    common_replace = f'?v={version_tag}'
    version_ok = _update_file(index_path, common_pattern, common_replace)

    # 2. CSS Bundle
    css_ok = _update_file(index_path, r'assets/style\.css', 'assets/style.bundle.css')

    # 3. JS Offline
    js_ok = True
    if is_offline:
        js_pattern = r'<script\s+type="module"\s+src="assets/modules/core/app\.js(.*?)"(.*?)</script>'
        js_replace = r'<script defer src="assets/app.bundle.js\1"></script>'
        js_ok = _update_file(index_path, js_pattern, js_replace)

    return version_ok and css_ok and js_ok

def patch_online_html(build_dir: Path, version_tag: str) -> bool:
    logger.info("📝 Patching index.html (Online Mode)...")
    index_path = build_dir / "index.html"
    return _patch_html_assets(index_path, version_tag, is_offline=False)

def patch_offline_html(build_dir: Path, version_tag: str) -> bool:
    logger.info("📝 Patching index.html (Offline Mode)...")
    index_path = build_dir / "index.html"
    return _patch_html_assets(index_path, version_tag, is_offline=True)

def inject_offline_index_script(build_dir: Path) -> bool:
    index_path = build_dir / "index.html"
    logger.info("💉 Injecting db_index.js script tag...")
    script_tag = '<script src="assets/db_index.js"></script>'
    pattern = r'(<script defer src="assets/app\.bundle\.js.*?)</script>')
    replacement = f'{script_tag}\n    \1'
    return _update_file(index_path, pattern, replacement)
