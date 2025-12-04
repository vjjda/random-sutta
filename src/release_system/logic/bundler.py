# Path: src/release_system/logic/bundler.py
import logging
import re
from pathlib import Path
from typing import List

from ..config import WEB_DIR

logger = logging.getLogger("Release.Bundler")

def bundle_javascript(file_list: List[str]) -> bool:
    """
    Gộp các file ES Modules thành app.bundle.js.
    Loại bỏ 'import' và 'export' để chạy trên file:// protocol.
    """
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
                # 1. Skip imports
                if line.strip().startswith("import "):
                    continue
                
                # 2. Remove 'export' keyword
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