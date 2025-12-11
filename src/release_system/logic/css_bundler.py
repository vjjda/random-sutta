# Path: src/release_system/logic/css_bundler.py
import logging
import re
import shutil
import os
from pathlib import Path
from typing import Set

logger = logging.getLogger("Release.CSSBundler")

def _rewrite_urls(content: str, source_file: Path, bundle_dir: Path) -> str:
    """
    Tìm và viết lại các đường dẫn url(...) trong CSS.
    Chuyển từ: Tương đối với source_file
    Sang: Tương đối với bundle_dir (nơi đặt style.bundle.css)
    """
    # Regex bắt: url("..."), url('...'), hoặc url(...)
    # Group 2: Quote (hoặc rỗng)
    # Group 3: Path
    url_pattern = re.compile(r'url\s*\(\s*(["\']?)([^)"\']+)\1\s*\)')

    def replace_url(match):
        quote = match.group(1) or ""
        original_path = match.group(2).strip()

        # Bỏ qua Data URI hoặc Absolute URL (http/https)
        if original_path.startswith("data:") or original_path.startswith("http"):
            return match.group(0)

        try:
            # 1. Xác định vị trí tuyệt đối của tài nguyên gốc
            # source_file.parent là thư mục chứa file CSS con (vd: web/assets/css/base/)
            resource_abs_path = (source_file.parent / original_path).resolve()

            # 2. Tính toán đường dẫn tương đối từ thư mục bundle (vd: web/assets/) tới tài nguyên
            # bundle_dir là nơi file style.bundle.css sẽ nằm
            new_rel_path = os.path.relpath(resource_abs_path, bundle_dir)
            
            # Chuẩn hóa path separator cho Windows (\ -> /)
            new_rel_path = new_rel_path.replace("\\", "/")

            return f'url({quote}{new_rel_path}{quote})'
        except Exception as e:
            # Nếu lỗi (vd: path ảo), giữ nguyên
            return match.group(0)

    return url_pattern.sub(replace_url, content)

def _resolve_imports(base_dir: Path, file_path: Path, processed: Set[Path], bundle_output_dir: Path) -> str:
    """Đệ quy gộp nội dung CSS và viết lại URL."""
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

    # [NEW] Viết lại URL trước khi xử lý @import
    # Để đảm bảo path trong file con đúng với vị trí của file bundle
    content = _rewrite_urls(content, file_path, bundle_output_dir)

    # Regex bắt: @import "..." hoặc @import '...' ;
    import_pattern = re.compile(r'@import\s+url\((["\']?)([^"\')]+)\1\);?|@import\s+([\'"])(.+?)\3;?')

    def replace_import(match):
        rel_path = match.group(2) or match.group(4)
        if not rel_path: return ""
        
        full_child_path = (file_path.parent / rel_path).resolve()
        
        # Đệ quy
        return _resolve_imports(base_dir, full_child_path, processed, bundle_output_dir)

    return import_pattern.sub(replace_import, content)

def _minify_css(content: str) -> str:
    """Minify đơn giản."""
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)
    content = re.sub(r'\s*([\{,;:\}])\s*', r'\1', content)
    content = re.sub(r'\s\s+', ' ', content)
    return content.strip()

def bundle_css(base_dir: Path) -> bool:
    """
    Tạo style.bundle.css từ style.css.
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
        
        # [UPDATED] Truyền assets_dir vào để làm gốc tính toán path
        raw_content = _resolve_imports(base_dir, entry_file, processed, assets_dir)
        
        final_content = _minify_css(raw_content)
        
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(final_content)
        
        os.remove(entry_file)
        if css_modules_dir.exists():
            shutil.rmtree(css_modules_dir)
            
        logger.info("   ✅ Created style.bundle.css & Rewrote URLs")
        return True

    except Exception as e:
        logger.error(f"❌ CSS Bundling failed: {e}")
        return False