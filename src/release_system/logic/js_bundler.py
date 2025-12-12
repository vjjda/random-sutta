# Path: src/release_system/logic/js_bundler.py
import logging
import re
import shutil
from pathlib import Path
from typing import List

from .js_dependency_resolver import resolve_bundle_order

logger = logging.getLogger("Release.JSBundler")

def _cleanup_modules(base_dir: Path) -> None:
    assets_dir = base_dir / "assets"
    modules_dir = assets_dir / "modules"
    if modules_dir.exists():
        shutil.rmtree(modules_dir)
        logger.info("   🧹 Removed source modules directory: assets/modules/")

def _wrap_in_iife(content: str, file_name: str) -> str:
    # 1. Tìm các biến được export inline (vd: export const Router = ...)
    # Group 2: Name
    export_decl_pattern = r'export\s+(async\s+)?(function|class|const|let|var)\s+([a-zA-Z0-9_$]+)'
    matches = re.findall(export_decl_pattern, content)
    
    exports = [m[2] for m in matches]
    
    # 2. Xóa từ khóa 'export' ở đầu dòng khai báo
    # Chỉ xóa chữ export, giữ lại const/function...
    cleaned_content = re.sub(r'^export\s+(?=(?:async\s+)?(?:function|class|const|let|var))', '', content, flags=re.MULTILINE)

    # 3. Expose ra global window
    expose_code = ""
    if exports:
        assignments = [f"window.{name} = {name};" for name in exports]
        expose_code = "\n    // [Bundler] Expose exports to global scope\n    " + "\n    ".join(assignments)

    iife_template = (
        f"\n// --- Source: {file_name} --- \n"
        f"(() => {{\n"
        f"{cleaned_content}"
        f"{expose_code}\n"
        f"}})();\n"
    )
    return iife_template

def bundle_javascript(base_dir: Path) -> bool:
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
                content = f.read()
            
            # --- PHASE 1: PRE-PROCESSING (Regex) ---
            # [FIXED] Dùng Regex DOTALL để xử lý import/export nhiều dòng
            
            # 1. Remove all 'import ...' statements
            content = re.sub(r'import\s+.*?from\s+[\'"].*?[\'"];?', '', content, flags=re.DOTALL)
            content = re.sub(r'import\s+[\'"].*?[\'"];?', '', content, flags=re.DOTALL) # Side-effect imports

            # 2. Remove 'export ... from ...' (Re-exports từ Gateway)
            # Đây chính là nguyên nhân gây lỗi cú pháp
            content = re.sub(r'export\s+.*?from\s+[\'"].*?[\'"];?', '', content, flags=re.DOTALL)

            # 3. Remove empty 'export {};'
            content = re.sub(r'export\s*\{\s*\}\s*;?', '', content)

            # --- PHASE 2: WRAP ---
            # Chỉ bọc nếu còn nội dung có nghĩa
            if content.strip():
                iife_block = _wrap_in_iife(content, rel_path)
                combined_content.append(iife_block)

        with open(bundle_path, "w", encoding="utf-8") as f:
            f.write("\n".join(combined_content))
            
        logger.info(f"   ✅ Created bundle: app.bundle.js")
        _cleanup_modules(base_dir)
        return True

    except Exception as e:
        logger.error(f"❌ Bundling failed: {e}")
        return False