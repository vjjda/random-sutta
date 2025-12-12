# Path: src/release_system/logic/js_bundler.py
import logging
import re
import shutil
import os
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
    export_pattern = r'export\s+(async\s+)?(?:function|class|const|let|var)\s+([a-zA-Z0-9_$]+)'
    matches = re.findall(export_pattern, content)
    
    exports = [m[1] for m in matches]
    
    # 2. Xóa từ khóa 'export' ở đầu dòng khai báo
    cleaned_content = re.sub(r'^export\s+', '', content, flags=re.MULTILINE)
    
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
                raw_lines = f.readlines()
            
            # [FIXED] Bộ lọc thông minh hơn cho Barrel/Gateway files
            filtered_lines = []
            for line in raw_lines:
                s_line = line.strip()
                
                # 1. Bỏ dòng import
                if s_line.startswith("import "): continue
                
                # 2. Bỏ dòng Re-export (export ... from ...) -> Gây lỗi cú pháp nếu giữ lại 'from'
                if s_line.startswith("export ") and " from " in s_line: continue
                
                # 3. Bỏ dòng export all (*)
                if s_line.startswith("export *"): continue
                
                # 4. Bỏ dòng export { A, B } (Named exports độc lập)
                # Vì ta ưu tiên export inline (export const A). 
                # Nếu file chỉ có export {} thì coi như nó là file cấu hình/gateway, ko cần nội dung trong bundle.
                if s_line.startswith("export {"): continue

                filtered_lines.append(line)

            file_content_str = "".join(filtered_lines)
            
            # Chỉ bọc IIFE nếu file còn nội dung thực thi
            if file_content_str.strip():
                iife_block = _wrap_in_iife(file_content_str, rel_path)
                combined_content.append(iife_block)

        with open(bundle_path, "w", encoding="utf-8") as f:
            f.write("\n".join(combined_content))
            
        logger.info(f"   ✅ Created bundle: app.bundle.js")
        _cleanup_modules(base_dir)
        return True

    except Exception as e:
        logger.error(f"❌ Bundling failed: {e}")
        return False