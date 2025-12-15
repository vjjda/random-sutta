# Path: src/release_system/logic/html_patcher.py
import logging
import re
import base64
from pathlib import Path
from ..release_config import VERSION_PLACEHOLDER

logger = logging.getLogger("Release.HtmlPatcher")

def _update_file(file_path: Path, pattern: str, replacement: str) -> bool:
    if not file_path.exists():
        logger.warning(f"⚠️ File not found: {file_path}")
        return False
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Chỉ replace nếu tìm thấy, tránh log warning không cần thiết cho các replace phụ
        if re.search(pattern, content, flags=re.DOTALL):
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
    _update_file(index_path, common_pattern, common_replace)

    # 2. CSS Bundle
    _update_file(index_path, r'assets/style\.css', 'assets/style.bundle.css')

    # 3. JS Offline Bundle
    if is_offline:
        js_pattern = r'<script\s+type="module"\s+src="assets/modules/core/app\.js(.*?)"(.*?)</script>'
        # Bỏ type="module" và thay src
        js_replace = r'<script defer src="assets/app.bundle.js\1"></script>'
        _update_file(index_path, js_pattern, js_replace)

        # [FIXED] 4. Remove 'crossorigin' from Font Preloads
        # file:// protocol không hỗ trợ CORS, gây lỗi khi preload font
        # Tìm thẻ link preload font và xóa attribute crossorigin
        font_pattern = r'(<link\s+rel="preload"[^>]*as="font"[^>]*)\s+crossorigin'
        font_replace = r'\1'
        # Chạy nhiều lần để xóa hết các dòng font
        # Dùng while loop hoặc re.sub toàn cục (re.sub mặc định replace all)
        _update_file(index_path, font_pattern, font_replace)

        # [NEW] 5. Embed Manifest as Data URI (Fix CORS for file://)
        manifest_path = index_path.parent / "assets/icons/site.webmanifest"
        if manifest_path.exists():
            try:
                with open(manifest_path, "rb") as f:
                    manifest_data = f.read()
                    b64_manifest = base64.b64encode(manifest_data).decode("utf-8")
                    data_uri = f"data:application/manifest+json;base64,{b64_manifest}"
                    
                    manifest_pattern = r'href="assets/icons/site\.webmanifest"'
                    manifest_replace = f'href="{data_uri}"'
                    _update_file(index_path, manifest_pattern, manifest_replace)
                    logger.info("    ✅ Embedded manifest as Data URI")
            except Exception as e:
                logger.warning(f"    ⚠️ Failed to embed manifest: {e}")

    return True

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
    # Inject trước app.bundle.js
    script_tag = '<script src="assets/db_index.js"></script>'
    pattern = r'(<script defer src="assets/app\.bundle\.js.*?</script>)'
    replacement = f'{script_tag}\n    \\1'
    return _update_file(index_path, pattern, replacement)