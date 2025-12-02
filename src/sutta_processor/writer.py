# Path: src/sutta_processor/writer.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List

from .config import OUTPUT_SUTTA_BOOKS, OUTPUT_SUTTA_BASE, PROCESSED_DIR

logger = logging.getLogger("SuttaProcessor.Writer")

def _ensure_dir(path: Path) -> None:
    if not path.parent.exists():
        path.parent.mkdir(parents=True, exist_ok=True)

def write_book_file(
    group_name: str, 
    book_content: Dict[str, Any], 
    dry_run: bool = False
) -> str:
    """Ghi nội dung sách ra file (JSON cho debug hoặc JS cho production)."""
    
    # 1. Cấu hình Output
    if dry_run:
        output_base = PROCESSED_DIR
        file_name = f"{group_name}_book.json"
        indent = 2
    else:
        output_base = OUTPUT_SUTTA_BOOKS
        file_name = f"{group_name}_book.js"
        indent = None

    file_path = output_base / file_name
    _ensure_dir(file_path)

    # 2. Thực hiện ghi
    try:
        json_str = json.dumps(book_content, ensure_ascii=False, indent=indent)
        
        if dry_run:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(json_str)
        else:
            # Wrap vào biến Global JS
            safe_group = group_name.replace("/", "_")
            js_content = (
                f"window.SUTTA_DB = window.SUTTA_DB || {{}};\n"
                f"window.SUTTA_DB['{safe_group}'] = {json_str};"
            )
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(js_content)

        logger.info(f"   💾 Saved: {file_name} ({len(book_content.get('data', {}))} suttas)")
        return file_name
        
    except Exception as e:
        logger.error(f"❌ Failed to write {file_name}: {e}")
        return ""

def write_loader_script(file_list: List[str]) -> None:
    """Tạo file sutta_loader.js chứa danh sách các file đã build."""
    file_list.sort()
    # Loại bỏ các file rỗng hoặc lỗi
    valid_files = [f for f in file_list if f]
    
    loader_path = OUTPUT_SUTTA_BASE / "sutta_loader.js"
    _ensure_dir(loader_path)
    
    try:
        js_content = f"window.ALL_SUTTA_FILES = {json.dumps(valid_files, indent=2)};\n"
        with open(loader_path, "w", encoding="utf-8") as f:
            f.write(js_content)
        logger.info(f"✅ Loader generated with {len(valid_files)} entries.")
    except Exception as e:
        logger.error(f"❌ Failed to write loader: {e}")