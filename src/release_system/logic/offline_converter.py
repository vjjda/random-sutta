# Path: src/release_system/logic/offline_converter.py
import logging
import json
from pathlib import Path

logger = logging.getLogger("Release.OfflineConverter")

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

    for subdir in ["meta", "content"]: 
        target_dir = db_dir / subdir
        if not target_dir.exists(): 
            logger.warning(f"⚠️ Directory not found: {subdir}")
            continue
        
        json_files = list(target_dir.glob("*.json"))
        
        for json_file in json_files:
            try:
                key = json_file.stem
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
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
