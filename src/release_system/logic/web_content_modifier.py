# Path: src/release_system/logic/web_content_modifier.py
import logging
import re
from pathlib import Path
from ..release_config import VERSION_PLACEHOLDER

logger = logging.getLogger("Release.WebContentMod")

def _update_file(file_path: Path, pattern: str, replacement: str) -> bool:
    if not file_path.exists():
        logger.warning(f"⚠️ File not found: {file_path}")
        return False
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Sử dụng cờ re.DOTALL để dấu chấm (.) khớp với cả xuống dòng
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

# ... (Giữ nguyên inject_version_into_sw, inject_version_into_app_js, patch_sw_assets_for_offline) ...
def inject_version_into_sw(target_dir: Path, version_tag: str) -> bool:
    logger.info(f"💉 Injecting cache version '{version_tag}' into {target_dir.name}/sw.js...")
    sw_path = target_dir / "sw.js"
    pattern = rf'sutta-cache-{re.escape(VERSION_PLACEHOLDER)}'
    replacement = f'sutta-cache-{version_tag}'
    return _update_file(sw_path, pattern, replacement)

def inject_version_into_app_js(target_dir: Path, version_tag: str) -> bool:
    logger.info(f"💉 Injecting app version '{version_tag}' into app.js...")
    app_js_path = target_dir / "assets" / "modules" / "core" / "app.js"
    pattern = r'const APP_VERSION = "dev-placeholder";'
    replacement = f'const APP_VERSION = "{version_tag}";'
    return _update_file(app_js_path, pattern, replacement)

def patch_sw_assets_for_offline(target_dir: Path) -> bool:
    logger.info(f"💉 Patching sw.js assets list for Offline Bundle...")
    sw_path = target_dir / "sw.js"
    pattern = r'"\./assets/modules/core/app\.js"'
    replacement = '"./assets/app.bundle.js"'
    return _update_file(sw_path, pattern, replacement)

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
        # [FIXED REGEX] Linh hoạt hơn với khoảng trắng (\s+) và xuống dòng
        # Tìm thẻ script type="module" trỏ tới app.js
        # Group 1: Query params (ví dụ ?v=...)
        # Group 2: Phần còn lại của thẻ (ví dụ > hoặc attributes khác)
        js_pattern = r'<script\s+type="module"\s+src="assets/modules/core/app\.js(.*?)"(.*?)</script>'
        
        # Thay thế bằng script defer trỏ tới app.bundle.js
        # Giữ lại Group 1 (version param đã được patch ở bước 1)
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