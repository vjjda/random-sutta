# Path: src/sutta_processor/output/asset_generator.py
import json
import logging
from pathlib import Path
from typing import Dict, Any, List

# Cập nhật import biến mới
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
    # 1. Cấu hình Output
    if dry_run:
        output_base = PROCESSED_DIR
        file_name = f"{group_name}_book.json"
        indent = 2
    else:
        # Sử dụng biến mới OUTPUT_DB_DIR
        output_base = OUTPUT_DB_DIR
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
    file_list.sort()
    valid_files = [f for f in file_list if f]
    
    # Sử dụng biến mới OUTPUT_LOADER_DIR
    loader_path = OUTPUT_LOADER_DIR / "sutta_loader.js"
    _ensure_dir(loader_path)
    
    try:
        js_content = f"window.ALL_SUTTA_FILES = {json.dumps(valid_files, indent=2)};\n"
        with open(loader_path, "w", encoding="utf-8") as f:
            f.write(js_content)
        logger.info(f"✅ Loader generated with {len(valid_files)} entries.")
    except Exception as e:
        logger.error(f"❌ Failed to write loader: {e}")