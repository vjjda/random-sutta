# Path: src/release_system/logic/css_bundler.py
import logging
import re
import shutil
import os
from pathlib import Path
from typing import Set

logger = logging.getLogger("Release.CSSBundler")

def _resolve_imports(base_dir: Path, file_path: Path, processed: Set[Path]) -> str:
    """Đệ quy gộp nội dung CSS từ các file @import."""
    # Resolve symlinks và absolute path để tránh trùng lặp
    try:
        file_path = file_path.resolve()
    except FileNotFoundError:
        logger.warning(f"⚠️ CSS file not found: {file_path}")
        return ""

    if file_path in processed:
        return "" 
    processed.add(file_path)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        logger.error(f"❌ Error reading {file_path.name}: {e}")
        return ""

    # Regex bắt: @import "..." hoặc @import '...' ; (có thể có dấu ;)
    # Group 2 là đường dẫn
    import_pattern = re.compile(r'@import\s+url\((["\']?)([^"\')]+)\1\);?|@import\s+([\'"])(.+?)\3;?')

    def replace_import(match):
        # Lấy path từ các group regex (tùy thuộc format @import nào match)
        rel_path = match.group(2) or match.group(4)
        if not rel_path: return ""
        
        # Đường dẫn trong CSS là relative với file hiện tại
        full_child_path = (file_path.parent / rel_path).resolve()
        
        return _resolve_imports(base_dir, full_child_path, processed)

    return import_pattern.sub(replace_import, content)

def _minify_css(content: str) -> str:
    """Minify đơn giản: Xóa comment và khoảng trắng thừa."""
    # 1. Xóa comment /* ... */
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)
    # 2. Xóa khoảng trắng quanh { } : ; ,
    content = re.sub(r'\s*([\{,;:\}])\s*', r'\1', content)
    # 3. Xóa dòng trống và khoảng trắng lặp lại
    content = re.sub(r'\s\s+', ' ', content)
    return content.strip()

def bundle_css(base_dir: Path) -> bool:
    """
    Tạo style.bundle.css từ style.css và các imports.
    Sau đó xóa thư mục css/ nguồn để dọn dẹp bản build.
    """
    assets_dir = base_dir / "assets"
    entry_file = assets_dir / "style.css"
    output_file = assets_dir / "style.bundle.css"
    css_modules_dir = assets_dir / "css"

    if not entry_file.exists():
        logger.warning(f"⚠️ Entry style.css not found in {base_dir.name}")
        return False

    logger.info(f"🎨 Bundling CSS for {base_dir.name}...")

    try:
        processed: Set[Path] = set()
        # 1. Gộp nội dung
        raw_content = _resolve_imports(base_dir, entry_file, processed)
        
        # 2. Minify
        final_content = _minify_css(raw_content)
        
        # 3. Ghi file bundle
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(final_content)
        
        # 4. Cleanup: Xóa style.css gốc và folder modules 'css/'
        os.remove(entry_file)
        if css_modules_dir.exists():
            shutil.rmtree(css_modules_dir)
            
        logger.info("   ✅ Created style.bundle.css & Cleaned up sources")
        return True

    except Exception as e:
        logger.error(f"❌ CSS Bundling failed: {e}")
        return False