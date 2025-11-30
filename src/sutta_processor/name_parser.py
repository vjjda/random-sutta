# Path: src/sutta_processor/name_parser.py
import json
import logging
from pathlib import Path
from typing import Dict, List, Any

# UPDATED: Import DATA_API_DIR từ config
from .config import DATA_API_DIR, OUTPUT_NAMES_DIR, OUTPUT_SUTTA_BASE

logger = logging.getLogger("SuttaProcessor")

def process_names() -> List[str]:
    """
    Scans API JSON directory, processes JSONs, and outputs JS files with '-name' suffix.
    """
    if not DATA_API_DIR.exists():
        logger.warning(f"⚠️ API Data directory not found: {DATA_API_DIR}")
        return []

    OUTPUT_NAMES_DIR.mkdir(parents=True, exist_ok=True)
    
    generated_files = []
    # Quét tất cả file .json trong data/json (ví dụ: an.json, mn.json...)
    json_files = sorted(list(DATA_API_DIR.glob("*.json")))
    
    logger.info(f"📚 Processing {len(json_files)} API metadata files...")

    for file_path in json_files:
        try:
            book_code = file_path.stem # e.g. 'an', 'mn'
            
            with open(file_path, "r", encoding="utf-8") as f:
                raw_list = json.load(f)

            # Map: { "mn1": { "acronym": "MN 1", "title": "...", "original": "..." } }
            name_map: Dict[str, Dict[str, str]] = {}
            
            # API trả về một List các Dict
            if isinstance(raw_list, list):
                for item in raw_list:
                    uid = item.get("uid")
                    if not uid:
                        continue
                    
                    # Trích xuất thông tin
                    entry = {
                        "acronym": item.get("acronym") or "",
                        "translated_title": item.get("translated_title") or "",
                        "original_title": item.get("original_title") or ""
                    }
                    
                    # Clean up titles (trim whitespace)
                    entry["translated_title"] = entry["translated_title"].strip()
                    entry["original_title"] = entry["original_title"].strip()
                    
                    name_map[uid] = entry

            if not name_map:
                continue

            output_filename = f"{book_code}-name.js"
            output_path = OUTPUT_NAMES_DIR / output_filename
            
            json_content = json.dumps(name_map, ensure_ascii=False, indent=2)
            js_content = f"""// Source: {file_path.name}
window.SUTTA_NAMES = window.SUTTA_NAMES || {{}};
Object.assign(window.SUTTA_NAMES, {json_content});
"""
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(js_content)
            
            generated_files.append(output_filename)
            logger.info(f"   -> Metadata: {output_filename} ({len(name_map)} entries)")

        except Exception as e:
            logger.error(f"❌ Error processing API file {file_path.name}: {e}")

    return generated_files

def generate_name_loader(files: List[str]) -> None:
    """Generates 'name_loader.js' inside assets/sutta/."""
    if not files:
        return

    files.sort()
    loader_path = OUTPUT_SUTTA_BASE / "name_loader.js"
    
    js_content = f"""
// Auto-generated Name Loader
(function() {{
    const files = {json.dumps(files, indent=2)};
    const basePath = document.currentScript.src.replace('name_loader.js', 'names/');
    
    files.forEach(file => {{
        const script = document.createElement('script');
        script.src = basePath + file;
        script.async = false;
        document.head.appendChild(script);
    }});
}})();
"""
    with open(loader_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    logger.info("✅ Generated Name Loader: name_loader.js")