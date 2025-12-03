# Path: src/sutta_processor/output/asset_generator.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List

# Import biến cấu hình mới
from ..shared.app_config import OUTPUT_DB_DIR, OUTPUT_LOADER_DIR, PROCESSED_DIR

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
            # Biến group_name có thể chứa dấu gạch chéo (ví dụ: vinaya/pli-tv-bi-pm)
            # Cần replace thành dấu gạch dưới để làm key trong object JS
            safe_group = group_name.replace("/", "_")
            
            # Kỹ thuật này giúp tránh CORS: gán dữ liệu vào biến toàn cục ngay khi load script
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
    except Exception as e:
        logger.error(f"❌ Failed to write loader: {e}")