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
        
        # [IMPORTANT] Dùng re.sub để thay thế, chỉ thay thế 1 lần đầu tìm thấy
        new_content = re.sub(pattern, replacement, content, count=1)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True
    except Exception as e:
        logger.error(f"❌ Error updating {file_path.name}: {e}")
        return False

def inject_version_into_sw(target_dir: Path, version_tag: str) -> bool:
    """
    [BUILD ONLY] Tiêm version tag vào file sw.js tại thư mục đích (build folder).
    Không đụng vào source code gốc.
    """
    logger.info(f"💉 Injecting cache version '{version_tag}' into {target_dir.name}/sw.js...")
    sw_path = target_dir / "sw.js"
    
    # Regex bắt dòng: const CACHE_NAME = "bat-ky-cai-gi-o-day";
    return _update_file(
        sw_path,
        r'const CACHE_NAME\s*=\s*["\'].*?["\'];', 
        f'const CACHE_NAME = "sutta-cache-{version_tag}";'
    )

def patch_build_html(build_dir: Path, version_tag: str) -> bool:
    # ... (Giữ nguyên hàm này như cũ, vì nó đã sửa trên build_dir rồi)
    # [Code cũ của hàm patch_build_html giữ nguyên]
    logger.info("📝 Patching index.html in build sandbox...")
    index_path = build_dir / "index.html"
    
    success = _update_file(
        index_path,
        r'<script type="module" src="assets/app.js.*"></script>',
        f'<script defer src="assets/app.bundle.js?v={version_tag}"></script>'
    )
    
    if success:
        _update_file(
            index_path,
            r'(assets\/.*?\.(?:css|js))(?:\?v=[^"\']*)?',
            f'\\1?v={version_tag}'
        )
    return success