# Path: src/release_system/logic/web_content_modifier.py
import logging
import re
import json
from pathlib import Path
from ..release_config import VERSION_PLACEHOLDER

logger = logging.getLogger("Release.WebContentMod")

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
    pattern = r'const APP_VERSION = "dev-placeholder";'
    replacement = f'const APP_VERSION = "{version_tag}";'
    return _update_file(app_js_path, pattern, replacement)

def create_offline_index_js(build_dir: Path) -> bool:
    try:
        json_path = build_dir / "assets" / "db" / "uid_index.json"
        js_path = build_dir / "assets" / "db_index.js"
        
        if not json_path.exists():
            logger.error(f"❌ Source file missing: {json_path}")
            return False
             
        logger.info(f"🔨 Converting {json_path.name} to JS variable...")
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        js_content = f"window.__DB_INDEX__ = {json.dumps(data, ensure_ascii=False)};"
        
        with open(js_path, 'w', encoding='utf-8') as f:
            f.write(js_content)
            
        # [CLEANUP] Remove source JSON
        json_path.unlink()
        logger.info(f"   🧹 Removed source: {json_path.name}")
            
        return True
    except Exception as e:
        logger.error(f"❌ Failed to create offline index JS: {e}")
        return False

def convert_db_json_to_js(build_dir: Path) -> bool:
    logger.info("🔨 Converting DB JSON files to JS for Offline support...")
    
    db_dir = build_dir / "assets" / "db"
    if not db_dir.exists():
        logger.error("DB directory not found")
        return False

    success_count = 0
    fail_count = 0

    # [FIX] Đổi "structure" thành "meta"
    for subdir in ["meta", "content"]:
        target_dir = db_dir / subdir
        if not target_dir.exists(): continue
        
        json_files = list(target_dir.glob("*.json"))
        
        for json_file in json_files:
            try:
                # Key sẽ là tên file (vd: an1_chunk_0)
                # Frontend SuttaRepository đã được update để dùng key này
                key = json_file.stem
                
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Hàm receive tương ứng với DB Loader trong index.html (sẽ được inject)
                method = "getMeta" if subdir == "meta" else "getContent"
                # Nhưng thực tế ta dùng chung 1 loader generic hoặc 2 loader riêng
                # Ở đây ta giả định window.__DB_LOADER__.receive(key, data) là đủ
                # Tuy nhiên, để tối ưu RAM, ta nên chia ra
                
                # Tạm thời dùng format chung:
                js_content = f'window.__DB_LOADER__.receive("{key}", {json.dumps(data, ensure_ascii=False)});'
                
                js_file = json_file.with_suffix('.js')
                with open(js_file, 'w', encoding='utf-8') as f:
                    f.write(js_content)
                
                json_file.unlink()
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to convert {json_file.name}: {e}")
                fail_count += 1

    logger.info(f"✨ Converted & Cleaned {success_count} files (Failed: {fail_count})")
    return True

def inject_offline_index_script(build_dir: Path) -> bool:
    index_path = build_dir / "index.html"
    logger.info("💉 Injecting db_index.js script tag...")
    
    script_tag = '<script src="assets/db_index.js"></script>'
    pattern = r'(<script defer src="assets/app\.bundle\.js.*?</script>)'
    replacement = f'{script_tag}\n    \\1'
    
    return _update_file(index_path, pattern, replacement)

def patch_sw_assets_for_offline(target_dir: Path) -> bool:
    logger.info(f"💉 Patching sw.js assets list for Offline Bundle...")
    sw_path = target_dir / "sw.js"
    
    # 1. Patch app.js -> app.bundle.js
    pat1 = r'"\./assets/modules/core/app\.js"'
    rep1 = '"./assets/app.bundle.js"'
    res1 = _update_file(sw_path, pat1, rep1)
    
    # 2. [FIX] Patch uid_index.json -> db_index.js
    # Vì uid_index.json đã bị xóa trong bản offline, SW không được cache nó nữa
    # Thay vào đó cache file db_index.js mới tạo
    pat2 = r'"\./assets/db/uid_index\.json",'
    rep2 = '"./assets/db_index.js",'
    res2 = _update_file(sw_path, pat2, rep2)
    
    return res1 or res2

def _patch_html_assets(index_path: Path, version_tag: str, is_offline: bool) -> bool:
    # 1. Version Param
    common_pattern = rf'\?v={re.escape(VERSION_PLACEHOLDER)}'
    common_replace = f'?v={version_tag}'
    version_ok = _update_file(index_path, common_pattern, common_replace)

    # 2. CSS Bundle
    css_ok = _update_file(index_path, r'assets/style\.css', 'assets/style.bundle.css')

    # 3. JS Offline
    js_ok = True
    if is_offline:
        js_pattern = r'<script\s+type="module"\s+src="assets/modules/core/app\.js(.*?)"(.*?)</script>'
        js_replace = r'<script defer src="assets/app.bundle.js\1"></script>'
        js_ok = _update_file(index_path, js_pattern, js_replace)

    return version_ok and css_ok and js_ok

def patch_online_html(build_dir: Path, version_tag: str) -> bool:
    logger.info("📝 Patching index.html (Online Mode)...")
    index_path = build_dir / "index.html"
    return _patch_html_assets(index_path, version_tag, is_offline=False)

def patch_offline_html(build_dir: Path, version_tag: str) -> bool:
    logger.info("📝 Patching index.html (Offline Mode)...")
    index_path = build_dir / "index.html"
    return _patch_html_assets(index_path, version_tag, is_offline=True)