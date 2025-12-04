# Path: src/release_system/logic/js_bundler.py
import logging
import re
from pathlib import Path

from ..release_config import WEB_DIR # [UPDATED] Import
from .js_dependency_resolver import resolve_bundle_order # [UPDATED] Import

logger = logging.getLogger("Release.JSBundler")

def bundle_javascript() -> bool:
    file_list = resolve_bundle_order()
    if not file_list:
        logger.error("❌ Dependency resolution failed.")
        return False

    logger.info("🧶 Bundling JavaScript modules...")
    bundle_path = WEB_DIR / "assets" / "app.bundle.js"
    
    try:
        combined_content = ["// Bundled for Offline Use (file:// protocol)"]
        for rel_path in file_list:
            file_path = WEB_DIR / rel_path
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
            
        logger.info(f"   ✅ Created bundle: {bundle_path.name}")
        return True
    except Exception as e:
        logger.error(f"❌ Bundling failed: {e}")
        return False