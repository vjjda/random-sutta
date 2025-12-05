# Path: src/release_system/logic/js_bundler.py
import logging
import re
import shutil
import os # [NEW] Import os
from pathlib import Path
from typing import List

from .js_dependency_resolver import resolve_bundle_order

logger = logging.getLogger("Release.JSBundler")

def _cleanup_modules(base_dir: Path) -> None:
    """
    Dọn dẹp các file nguồn JS thừa sau khi đã bundle xong.
    1. Xóa thư mục assets/modules
    2. Xóa file assets/app.js (vì đã có app.bundle.js)
    """
    assets_dir = base_dir / "assets"
    
    # 1. Xóa folder modules
    modules_dir = assets_dir / "modules"
    if modules_dir.exists():
        shutil.rmtree(modules_dir)
        logger.info("   🧹 Removed source: assets/modules/")

    # 2. [NEW] Xóa file app.js gốc
    app_js = assets_dir / "app.js"
    if app_js.exists():
        os.remove(app_js)
        logger.info("   🧹 Removed source: assets/app.js")

def _wrap_in_iife(content: str, file_name: str) -> str:
    """
    Bọc code trong IIFE để tránh xung đột biến.
    Tự động detect 'export' để expose ra global window cho các file sau dùng.
    """
    # 1. Tìm các biến được export (ví dụ: export const Router = ...)
    # Regex bắt: export + (const/let/var/function/class) + Tên biến
    export_pattern = r'export\s+(?:const|let|var|function|class)\s+([a-zA-Z0-9_$]+)'
    exports = re.findall(export_pattern, content)
    
    # 2. Xóa từ khóa 'export' (giữ lại khai báo)
    cleaned_content = re.sub(r'^export\s+', '', content, flags=re.MULTILINE)
    
    # 3. Tạo code expose ra window
    expose_code = ""
    if exports:
        assignments = [f"window.{name} = {name};" for name in exports]
        expose_code = "\n    // [Bundler] Expose exports to global scope\n    " + "\n    ".join(assignments)

    # 4. Gói vào IIFE
    iife_template = (
        f"\n// --- Source: {file_name} --- \n"
        f"(() => {{\n"
        f"{cleaned_content}"
        f"{expose_code}\n"
        f"}})();\n"
    )
    return iife_template

def bundle_javascript(base_dir: Path) -> bool:
    """Tạo bundle (IIFE) và dọn dẹp file thừa."""
    
    # 1. Resolve order
    file_list = resolve_bundle_order(base_dir)
    if not file_list:
        return False

    logger.info(f"🧶 Bundling {len(file_list)} files in {base_dir.name}...")
    bundle_path = base_dir / "assets" / "app.bundle.js"
    
    try:
        combined_content = ["// Bundled for Offline Use (IIFE Mode)"]
        
        for rel_path in file_list:
            file_path = base_dir / rel_path
            
            with open(file_path, "r", encoding="utf-8") as f:
                raw_lines = f.readlines()
            
            # Lọc bỏ dòng import
            filtered_lines = [line for line in raw_lines if not line.strip().startswith("import ")]
            file_content_str = "".join(filtered_lines)
            
            # Bọc IIFE và xử lý Export
            iife_block = _wrap_in_iife(file_content_str, rel_path)
            combined_content.append(iife_block)

        with open(bundle_path, "w", encoding="utf-8") as f:
            f.write("\n".join(combined_content))
            
        logger.info(f"   ✅ Created bundle: app.bundle.js")

        # 2. Dọn dẹp module thừa ngay lập tức
        _cleanup_modules(base_dir)

        return True

    except Exception as e:
        logger.error(f"❌ Bundling failed: {e}")
        return False