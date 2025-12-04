# Path: src/release_system/logic/js_bundler.py
import logging
import re
from pathlib import Path

# [CHANGED] Nhận base_dir thay vì import WEB_DIR cứng
from .js_dependency_resolver import resolve_bundle_order

logger = logging.getLogger("Release.JSBundler")

def bundle_javascript(base_dir: Path) -> bool:
    """Tạo bundle tại base_dir/assets/app.bundle.js"""
    
    # 1. Resolve order từ sandbox
    file_list = resolve_bundle_order(base_dir)
    
    if not file_list:
        return False

    logger.info(f"🧶 Bundling {len(file_list)} files in {base_dir.name}...")
    bundle_path = base_dir / "assets" / "app.bundle.js"
    
    try:
        combined_content = ["// Bundled for Offline Use"]
        
        for rel_path in file_list:
            file_path = base_dir / rel_path
            
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            file_content = []
            for line in lines:
                if line.strip().startswith("import "): continue
                line = re.sub(r'^export\s+', '', line)
                file_content.append(line)
            
            combined_content.append(f"\n// --- Source: {rel_path} ---")
            combined_content.append("".join(file_content))

        with open(bundle_path, "w", encoding="utf-8") as f:
            f.write("\n".join(combined_content))
            
        logger.info(f"   ✅ Created bundle: app.bundle.js")
        return True
    except Exception as e:
        logger.error(f"❌ Bundling failed: {e}")
        return False