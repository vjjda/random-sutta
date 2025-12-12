# Path: src/release_system/logic/offline_converter.py
import logging
import json
from pathlib import Path

logger = logging.getLogger("Release.OfflineConverter")

def create_offline_index_js(build_dir: Path) -> bool:
    try:
        # Index tổng (Offline dùng Monolithic Index)
        json_path = build_dir / "assets" / "db" / "uid_index.json"
        js_path = build_dir / "assets" / "db_index.js"
        
        if not json_path.exists():
            # Fallback: Nếu không có uid_index.json (do optimizer chia nhỏ), 
            # ta phải gộp lại hoặc báo lỗi. 
            # Tuy nhiên, orchestrator.py hiện đã save cả 2 loại index nên chắc chắn có.
            logger.error(f"❌ Source file missing: {json_path}")
            return False
             
        logger.info(f"🔨 Converting {json_path.name} to JS variable...")
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        js_content = f"window.__DB_INDEX__ = {json.dumps(data, ensure_ascii=False)};"
        with open(js_path, 'w', encoding='utf-8') as f:
            f.write(js_content)
            
        # Không xóa json gốc để tránh lỗi reference nếu có logic nào đó vẫn cần
        # json_path.unlink() 
        return True
    except Exception as e:
        logger.error(f"❌ Failed to create offline index JS: {e}")
        return False

def convert_db_json_to_js(build_dir: Path) -> bool:
    logger.info("🔨 Converting DB JSON files to JS (JSONP)...")
    db_dir = build_dir / "assets" / "db"
    if not db_dir.exists():
        return False

    success_count = 0
    
    # Duyệt cả meta và content
    for subdir in ["meta", "content"]: 
        target_dir = db_dir / subdir
        if not target_dir.exists(): continue
        
        json_files = list(target_dir.glob("*.json"))
        
        for json_file in json_files:
            try:
                # Key định danh: "meta/mn" hoặc "content/mn_chunk_0"
                # Tuy nhiên để đơn giản, ta dùng filename (unique enough)
                key = json_file.stem # "mn_chunk_0"
                
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Wrap vào hàm receive
                js_content = f'window.__DB_LOADER__.receive("{key}", {json.dumps(data, ensure_ascii=False)});'
                
                js_file = json_file.with_suffix('.js')
                with open(js_file, 'w', encoding='utf-8') as f:
                    f.write(js_content)
                
                # Xóa file json gốc để tiết kiệm dung lượng build offline
                json_file.unlink()
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to convert {json_file.name}: {e}")

    logger.info(f"✨ Converted {success_count} files to JS.")
    return True