# Path: src/release_system/logic/sw_patcher.py
import logging
import re
from pathlib import Path

logger = logging.getLogger("Release.SwPatcher")

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

def patch_sw_style_bundle(target_dir: Path) -> bool:
    """Cập nhật sw.js để cache style.bundle.css thay vì style.css."""
    logger.info(f"💉 Patching sw.js style asset (CSS Bundle)...")
    sw_path = target_dir / "sw.js"
    pattern = r'"\./assets/style\.css"'
    replacement = '"./assets/style.bundle.css"'
    return _update_file(sw_path, pattern, replacement)

def patch_sw_assets_for_offline(target_dir: Path) -> bool:
    logger.info(f"💉 Patching sw.js assets list for Offline Bundle...")
    sw_path = target_dir / "sw.js"
    
    # 1. Patch app.js -> app.bundle.js
    pat1 = r'"\./assets/modules/core/app\.js"'
    rep1 = '"./assets/app.bundle.js"'
    res1 = _update_file(sw_path, pat1, rep1)
    
    # 2. Patch uid_index.json -> db_index.js
    pat2 = r'"\./assets/db/uid_index\.json",'
    rep2 = '"./assets/db_index.js",'
    res2 = _update_file(sw_path, pat2, rep2)
    
    return res1 or res2

def patch_online_assets(target_dir: Path) -> bool:
    """
    Quét toàn bộ file .js trong assets/modules và assets/libs để inject vào sw.js.
    """
    logger.info("💉 Patching sw.js assets for Online Unbundled Build...")
    sw_path = target_dir / "sw.js"
    
    scan_dirs = [
        target_dir / "assets" / "modules",
        target_dir / "assets" / "libs"
    ]

    js_files = []
    
    for folder in scan_dirs:
        if not folder.exists():
            continue
            
        for file_path in folder.rglob("*.js"):
            rel_path = file_path.relative_to(target_dir)
            js_path_str = f'"./{rel_path.as_posix()}"'
            
            if "app.js" in js_path_str or "constants.js" in js_path_str:
                continue
                
            js_files.append(js_path_str)

    if not js_files:
        logger.warning("⚠️ No JS files found to inject.")
        return False

    # 2. Tạo string để replace
    # Format: 
    #   "./path/1.js",
    #   "./path/2.js",
    injection_content = ",\n  ".join(js_files)
    
    # 3. Inject vào placeholder
    pattern = r"// \[AUTO_GENERATED_ASSETS\]"
    # Note: re.sub cần escape backslash trong replacement string nếu có, nhưng ở đây chỉ có path đơn giản.
    return _update_file(sw_path, pattern, injection_content)
