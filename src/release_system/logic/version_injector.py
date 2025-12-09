# Path: src/release_system/logic/version_injector.py
import logging
import re
from pathlib import Path
from ..release_config import VERSION_PLACEHOLDER

logger = logging.getLogger("Release.VersionInjector")

def _update_file(file_path: Path, pattern: str, replacement: str) -> bool:
    if not file_path.exists():
        logger.warning(f"⚠️ File not found: {file_path}")
        return False
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        if not re.search(pattern, content, flags=re.DOTALL):
            logger.warning(f"⚠️ Pattern '{pattern}' not found in {file_path.name}")
            return False

        new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True
    except Exception as e:
        logger.error(f"❌ Error updating {file_path.name}: {e}")
        return False

def inject_version_into_sw(target_dir: Path, version_tag: str) -> bool:
    logger.info(f"💉 Injecting cache version '{version_tag}' into {target_dir.name}/sw.js...")
    sw_path = target_dir / "sw.js"
    pattern = rf'sutta-cache-{re.escape(VERSION_PLACEHOLDER)}'
    replacement = f'sutta-cache-{version_tag}'
    return _update_file(sw_path, pattern, replacement)

def inject_version_into_app_js(target_dir: Path, version_tag: str) -> bool:
    logger.info(f"💉 Injecting app version '{version_tag}' into app.js...")
    app_js_path = target_dir / "assets" / "modules" / "core" / "app.js"
    # Pattern khớp với const APP_VERSION = "...";
    pattern = r'const APP_VERSION = ".*?";' 
    replacement = f'const APP_VERSION = "{version_tag}";'
    return _update_file(app_js_path, pattern, replacement)

def inject_version_into_offline_manager(target_dir: Path, version_tag: str) -> bool:
    """[NEW] Inject version vào offline_manager.js để logic check update hoạt động đúng."""
    logger.info(f"💉 Injecting version '{version_tag}' into offline_manager.js...")
    file_path = target_dir / "assets" / "modules" / "ui" / "managers" / "offline_manager.js"
    pattern = r'const APP_VERSION = ".*?";'
    replacement = f'const APP_VERSION = "{version_tag}";'
    return _update_file(file_path, pattern, replacement)
