# Path: src/sutta_processor/output/asset_generator.py
import json
import logging
import re  # [NEW] Import regex
from pathlib import Path
from typing import Dict, Any, List

# Import biến cấu hình mới
from ..shared.app_config import OUTPUT_DB_DIR, OUTPUT_LOADER_DIR, PROCESSED_DIR, ASSETS_ROOT # [NEW] Added ASSETS_ROOT

logger = logging.getLogger("SuttaProcessor.Output.Generator")

def _ensure_dir(path: Path) -> None:
    if not path.parent.exists():
        path.parent.mkdir(parents=True, exist_ok=True)

def write_book_file(
    group_name: str, 
    book_content: Dict[str, Any], 
    dry_run: bool = False
) -> str:
    # ... (Giữ nguyên toàn bộ nội dung hàm này) ...
    """
    Ghi nội dung sách ra file.
    - Dry-run: .json (để debug)
    - Production: .js (để chạy web offline)
    """
    
    # 1. Cấu hình Output
    if dry_run:
        output_base = PROCESSED_DIR
        # Debug thì vẫn dùng .json
        file_name = f"{group_name}_book.json"
        indent = 2
    else:
        # Production dùng .js và lưu vào web/assets/books/
        output_base = OUTPUT_DB_DIR
        file_name = f"{group_name}_book.js" 
        indent = None # Minify cho nhẹ

    file_path = output_base / file_name
    _ensure_dir(file_path)

    # 2. Thực hiện ghi
    try:
        json_str = json.dumps(book_content, ensure_ascii=False, indent=indent)
        
        if dry_run:
            # Ghi file JSON thuần
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(json_str)
        else:
            # Ghi file JS (JSONP style)
            safe_group = group_name.replace("/", "_")
            js_content = (
                f"window.SUTTA_DB = window.SUTTA_DB || {{}};\n"
                f"window.SUTTA_DB['{safe_group}'] = {json_str};"
            )
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(js_content)

        logger.info(f"   💾 Saved: {file_name} ({len(book_content.get('data', {}))} items)")
        return file_name
        
    except Exception as e:
        logger.error(f"❌ Failed to write {file_name}: {e}")
        return ""

def update_service_worker(file_list: List[str]) -> None:
    """
    [NEW] Tự động cập nhật danh sách file trong web/sw.js
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
    
    # File này nằm ở OUTPUT_LOADER_DIR (tức là web/assets/)
    loader_path = OUTPUT_LOADER_DIR / "sutta_loader.js"
    _ensure_dir(loader_path)
    
    try:
        # Xuất ra mảng JS chứa tên file
        js_content = f"window.ALL_SUTTA_FILES = {json.dumps(valid_files, indent=2)};\n"
        with open(loader_path, "w", encoding="utf-8") as f:
            f.write(js_content)
        logger.info(f"✅ Loader generated with {len(valid_files)} entries.")
        
        # [NEW] Gọi hàm update SW ngay sau khi có danh sách file
        update_service_worker(valid_files)
        
    except Exception as e:
        logger.error(f"❌ Failed to write loader: {e}")