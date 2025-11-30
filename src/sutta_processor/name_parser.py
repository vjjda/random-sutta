# Path: src/sutta_processor/name_parser.py
import json
import logging
from pathlib import Path
from typing import Dict, List

# UPDATED: Import OUTPUT_SUTTA_BASE để đặt loader, OUTPUT_NAMES_DIR để đặt data
from .config import DATA_NAME_DIR, OUTPUT_NAMES_DIR, OUTPUT_SUTTA_BASE

logger = logging.getLogger("SuttaProcessor")

def _parse_sutta_id_from_key(key: str) -> str:
    """
    Parses keys like 'an-name:3.an1.1-10' to extract 'an1.1-10'.
    """
    try:
        if ":" not in key:
            return ""
        index_part = key.split(":", 1)[1]
        if "." not in index_part:
            return ""
        return index_part.split(".", 1)[1]
    except Exception:
        return ""

def process_names() -> List[str]:
    """
    Scans name directory, processes JSONs, and outputs JS files with '-name' suffix.
    """
    if not DATA_NAME_DIR.exists():
        logger.warning(f"⚠️ Name directory not found: {DATA_NAME_DIR}")
        return []

    # UPDATED: Tạo folder names bên trong sutta
    OUTPUT_NAMES_DIR.mkdir(parents=True, exist_ok=True)
    
    generated_files = []
    json_files = sorted(list(DATA_NAME_DIR.glob("*-name_*.json")))
    
    logger.info(f"📚 Processing {len(json_files)} name files...")

    for file_path in json_files:
        try:
            filename_parts = file_path.name.split("-name")
            if not filename_parts:
                continue
            book_code = filename_parts[0]
            
            with open(file_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)

            name_map: Dict[str, str] = {}
            for key, title in raw_data.items():
                sutta_id = _parse_sutta_id_from_key(key)
                if sutta_id and title:
                    name_map[sutta_id] = title.strip()

            if not name_map:
                continue

            output_filename = f"{book_code}-name.js"
            # UPDATED: Xuất vào assets/sutta/names/
            output_path = OUTPUT_NAMES_DIR / output_filename
            
            json_content = json.dumps(name_map, ensure_ascii=False, indent=2)
            js_content = f"""// Source: {file_path.name}
window.SUTTA_NAMES = window.SUTTA_NAMES || {{}};
Object.assign(window.SUTTA_NAMES, {json_content});
"""
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(js_content)
            
            generated_files.append(output_filename)
            logger.info(f"   -> Name Map: {output_filename} ({len(name_map)} entries)")

        except Exception as e:
            logger.error(f"❌ Error processing name file {file_path.name}: {e}")

    return generated_files

def generate_name_loader(files: List[str]) -> None:
    """Generates 'name_loader.js' inside assets/sutta/."""
    if not files:
        return

    files.sort()
    # UPDATED: Loader nằm ngang hàng với sutta_loader.js (trong assets/sutta/)
    loader_path = OUTPUT_SUTTA_BASE / "name_loader.js"
    
    js_content = f"""
// Auto-generated Name Loader
(function() {{
    const files = {json.dumps(files, indent=2)};
    // UPDATED: Script này ở assets/sutta/name_loader.js
    // Data files ở assets/sutta/names/*.js
    // -> thay 'name_loader.js' thành 'names/'
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