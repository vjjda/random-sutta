# Path: src/sutta_processor/output/asset_generator.py
import json
import logging
import re
from pathlib import Path
from typing import Dict, Any, List

# Import biến cấu hình mới
from ..shared.app_config import OUTPUT_DB_DIR, OUTPUT_LOADER_DIR, PROCESSED_DIR, ASSETS_ROOT

logger = logging.getLogger("SuttaProcessor.Output.Generator")

def _ensure_dir(path: Path) -> None:
    if not path.parent.exists():
        path.parent.mkdir(parents=True, exist_ok=True)

def write_book_file(
    group_name: str, 
    book_content: Dict[str, Any], 
    dry_run: bool = False
) -> str:
    """
    Ghi nội dung sách ra file.
    - Luôn ghi bản JSON vào data/processed (để debug/dry-run).
    - Nếu không phải dry-run, ghi thêm bản JS vào web/assets/books (để chạy app).
    """
    
    # 1. ALWAYS WRITE JSON (For Debugging/Inspection)
    json_path = PROCESSED_DIR / f"{group_name}_book.json"
    _ensure_dir(json_path)
    
    try:
        # JSON cần indent đẹp để dễ đọc
        json_str_pretty = json.dumps(book_content, ensure_ascii=False, indent=2)
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(json_str_pretty)
            
        # Nếu là Dry-run, dừng ở đây và trả về tên file json
        if dry_run:
            logger.info(f"   💾 Saved JSON (Dry-run): {json_path.name}")
            return json_path.name

    except Exception as e:
        logger.error(f"❌ Failed to write JSON {json_path.name}: {e}")
        return ""

    # 2. WRITE JS (Production Only)
    js_filename = f"{group_name}_book.js"
    js_path = OUTPUT_DB_DIR / js_filename
    _ensure_dir(js_path)

    try:
        # JS thì minify (không indent) để nhẹ
        json_str_minified = json.dumps(book_content, ensure_ascii=False, indent=None)
        
        safe_group = group_name.replace("/", "_")
        js_content = (
            f"window.SUTTA_DB = window.SUTTA_DB || {{}};\n"
            f"window.SUTTA_DB['{safe_group}'] = {json_str_minified};"
        )
        
        with open(js_path, "w", encoding="utf-8") as f:
            f.write(js_content)

        logger.info(f"   💾 Saved JS & JSON: {js_filename} ({len(book_content.get('content', {}))} items)")
        return js_filename # Trả về tên file JS để loader dùng
        
    except Exception as e:
        logger.error(f"❌ Failed to write JS {js_filename}: {e}")
        return ""

def update_service_worker(file_list: List[str]) -> None:
    """
    Tự động cập nhật danh sách file trong web/sw.js
    để đảm bảo Service Worker cache đúng file thật.
    """
    sw_path = ASSETS_ROOT.parent / "sw.js" # web/sw.js
    if not sw_path.exists():
        logger.warning("⚠️ sw.js not found, skipping cache update.")
        return

    # Tạo danh sách đường dẫn đầy đủ: "./assets/books/sutta/mn_book.js"
    sw_paths = [f"./assets/books/{f}" for f in file_list if f]
    
    # Tạo chuỗi JS array
    js_array_str = json.dumps(sw_paths, indent=2)
    new_declaration = f"const SUTTA_DATA_FILES = {js_array_str};"

    try:
        with open(sw_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Regex tìm biến SUTTA_DATA_FILES cũ (kể cả multiline và .map)
        # Tìm từ "const SUTTA_DATA_FILES =" cho đến dấu chấm phẩy đầu tiên
        pattern = r"const SUTTA_DATA_FILES\s*=\s*[\s\S]*?;"
        
        # Thay thế
        if re.search(pattern, content):
            new_content = re.sub(pattern, new_declaration, content, count=1)
            
            with open(sw_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            logger.info("   🔄 Updated sw.js with fresh file list.")
        else:
            logger.warning("⚠️ Could not find SUTTA_DATA_FILES variable in sw.js")

    except Exception as e:
        logger.error(f"❌ Failed to update sw.js: {e}")

def write_loader_script(file_list: List[str]) -> None:
    """Tạo file sutta_loader.js chứa danh sách file cần load."""
    file_list.sort()
    valid_files = [f for f in file_list if f]
    
    # File này nằm ở OUTPUT_LOADER_DIR (tức là web/assets/books/)
    loader_path = OUTPUT_LOADER_DIR / "sutta_loader.js"
    _ensure_dir(loader_path)
    
    try:
        # Xuất ra mảng JS chứa tên file
        js_content = f"window.ALL_SUTTA_FILES = {json.dumps(valid_files, indent=2)};\n"
        with open(loader_path, "w", encoding="utf-8") as f:
            f.write(js_content)
        logger.info(f"✅ Loader generated with {len(valid_files)} entries.")
        
        # Gọi hàm update SW ngay sau khi có danh sách file
        update_service_worker(valid_files)
        
    except Exception as e:
        logger.error(f"❌ Failed to write loader: {e}")