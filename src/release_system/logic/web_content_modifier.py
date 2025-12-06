# Path: src/release_system/logic/web_content_modifier.py
import logging
import re
from pathlib import Path
from ..release_config import VERSION_PLACEHOLDER

logger = logging.getLogger("Release.WebContentMod")

def _update_file(file_path: Path, pattern: str, replacement: str) -> bool:
    """
    Hàm helper để tìm và thay thế nội dung trong file dựa trên Regex.
    """
    if not file_path.exists():
        logger.warning(f"⚠️ File not found: {file_path}")
        return False
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Kiểm tra xem file có chứa pattern không trước khi thay thế
        if not re.search(pattern, content):
            # Đây có thể không phải là lỗi nghiêm trọng (ví dụ file đã được patch rồi),
            # nhưng log warning để biết.
            logger.warning(f"⚠️ Pattern '{pattern}' not found in {file_path.name}")
            return False

        new_content = re.sub(pattern, replacement, content)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True
    except Exception as e:
        logger.error(f"❌ Error updating {file_path.name}: {e}")
        return False

def inject_version_into_sw(target_dir: Path, version_tag: str) -> bool:
    """
    Thay thế placeholder trong SW.
    Target: const CACHE_NAME = "sutta-cache-dev-placeholder";
    """
    logger.info(f"💉 Injecting cache version '{version_tag}' into {target_dir.name}/sw.js...")
    sw_path = target_dir / "sw.js"
    
    # Regex tìm: sutta-cache-{VERSION_PLACEHOLDER}
    pattern = rf'sutta-cache-{re.escape(VERSION_PLACEHOLDER)}'
    replacement = f'sutta-cache-{version_tag}'
    
    return _update_file(sw_path, pattern, replacement)

def inject_version_into_app_js(target_dir: Path, version_tag: str) -> bool:
    """
    Thay thế placeholder trong app.js để kích hoạt Smart Background Download.
    Target: const APP_VERSION = "dev-placeholder";
    """
    logger.info(f"💉 Injecting app version '{version_tag}' into app.js...")
    
    # File app.js nằm trong modules/core
    app_js_path = target_dir / "assets" / "modules" / "core" / "app.js"
    
    pattern = r'const APP_VERSION = "dev-placeholder";'
    replacement = f'const APP_VERSION = "{version_tag}";'
    
    return _update_file(app_js_path, pattern, replacement)

def patch_sw_assets_for_offline(target_dir: Path) -> bool:
    """
    Trong bản Offline Build, ta dùng app.bundle.js thay vì modules/core/app.js.
    Cần sửa danh sách SHELL_ASSETS trong sw.js để cache đúng file bundle.
    """
    logger.info(f"💉 Patching sw.js assets list for Offline Bundle...")
    sw_path = target_dir / "sw.js"
    
    # Tìm dòng chứa path file module trong mảng SHELL_ASSETS
    pattern = r'"\./assets/modules/core/app\.js"'
    # Thay thế bằng path file bundle
    replacement = '"./assets/app.bundle.js"'
    
    return _update_file(sw_path, pattern, replacement)

def _patch_html_assets(index_path: Path, version_tag: str, is_offline: bool) -> bool:
    """
    Thay thế placeholder trong HTML.
    Target: ?v={VERSION_PLACEHOLDER}
    """
    # 1. Thay thế chung cho Version Param (?v=dev-placeholder -> ?v=v2025...)
    # Áp dụng cho cả CSS và JS (nếu khớp pattern)
    common_pattern = rf'\?v={re.escape(VERSION_PLACEHOLDER)}'
    common_replace = f'?v={version_tag}'
    
    version_ok = _update_file(index_path, common_pattern, common_replace)

    # 2. Xử lý CSS Bundle (style.css -> style.bundle.css)
    # Lưu ý: Lúc này version đã được thay ở bước 1, nên chỉ cần tìm tên file
    css_ok = _update_file(index_path, r'assets/style\.css', 'assets/style.bundle.css')

    # 3. Xử lý JS Offline (Nếu cần)
    js_ok = True
    if is_offline:
        # Chuyển app.js (module) thành app.bundle.js (defer)
        # Regex tìm thẻ script module
        js_pattern = r'<script type="module" src="assets/modules/core/app\.js(.*?)"(.*?)</script>'
        # Giữ lại phần query params (group 1) đã được replace version ở bước 1
        js_replace = r'<script defer src="assets/app.bundle.js\1"></script>'
        js_ok = _update_file(index_path, js_pattern, js_replace)

    return version_ok and css_ok and js_ok

def patch_online_html(build_dir: Path, version_tag: str) -> bool:
    logger.info("📝 Patching index.html (Online Mode)...")
    index_path = build_dir / "index.html"
    
    html_ok = _patch_html_assets(index_path, version_tag, is_offline=False)
    return html_ok

def patch_offline_html(build_dir: Path, version_tag: str) -> bool:
    logger.info("📝 Patching index.html (Offline Mode)...")
    index_path = build_dir / "index.html"
    
    html_ok = _patch_html_assets(index_path, version_tag, is_offline=True)
    return html_ok