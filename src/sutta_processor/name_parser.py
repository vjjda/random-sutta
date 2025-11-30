# Path: src/sutta_processor/name_parser.py
import json
import logging
from pathlib import Path
from typing import Dict, List, Any

from .config import DATA_API_DIR, OUTPUT_NAMES_DIR, OUTPUT_SUTTA_BASE

logger = logging.getLogger("SuttaProcessor")

# Danh sách các sách thuộc Khuddaka Nikaya
KN_BOOKS = {
    "bv", "cnd", "cp", "dhp", "iti", "ja", "kp", "mil", "mnd", 
    "ne", "pe", "ps", "pv", "snp", "tha-ap", "thag", "thi-ap", 
    "thig", "ud", "vv"
}

def process_names() -> List[str]:
    """
    Scans API JSON directory, processes JSONs, and outputs JS files with '-name' suffix.
    Handles subdirectory structure for KN books.
    """
    if not DATA_API_DIR.exists():
        logger.warning(f"⚠️ API Data directory not found: {DATA_API_DIR}")
        return []

    # Đảm bảo thư mục gốc tồn tại (và thư mục kn sẽ được tạo trong loop nếu cần)
    OUTPUT_NAMES_DIR.mkdir(parents=True, exist_ok=True)
    
    generated_files = []
    json_files = sorted(list(DATA_API_DIR.glob("*.json")))
    
    logger.info(f"📚 Processing {len(json_files)} API metadata files...")

    for file_path in json_files:
        try:
            book_code = file_path.stem # e.g. 'an', 'mn', 'dhp'
            
            with open(file_path, "r", encoding="utf-8") as f:
                raw_list = json.load(f)

            name_map: Dict[str, Dict[str, str]] = {}
            
            if isinstance(raw_list, list):
                for item in raw_list:
                    uid = item.get("uid")
                    if not uid:
                        continue
                    
                    entry = {
                        "acronym": item.get("acronym") or "",
                        "translated_title": item.get("translated_title") or "",
                        "original_title": item.get("original_title") or ""
                    }
                    
                    entry["translated_title"] = entry["translated_title"].strip()
                    entry["original_title"] = entry["original_title"].strip()
                    
                    name_map[uid] = entry

            if not name_map:
                continue

            # --- LOGIC PHÂN LOẠI THƯ MỤC ---
            output_filename = f"{book_code}-name.js"
            
            if book_code in KN_BOOKS:
                # Tạo folder kn nếu chưa có
                kn_dir = OUTPUT_NAMES_DIR / "kn"
                kn_dir.mkdir(exist_ok=True)
                
                output_path = kn_dir / output_filename
                # Lưu relative path để loader dùng (ví dụ: "kn/dhp-name.js")
                loader_entry = f"kn/{output_filename}"
            else:
                output_path = OUTPUT_NAMES_DIR / output_filename
                loader_entry = output_filename
            
            # Write JS File
            json_content = json.dumps(name_map, ensure_ascii=False, indent=2)
            js_content = f"""// Source: {file_path.name}
window.SUTTA_NAMES = window.SUTTA_NAMES || {{}};
Object.assign(window.SUTTA_NAMES, {json_content});
"""
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(js_content)
            
            generated_files.append(loader_entry)
            logger.info(f"   -> Metadata: {loader_entry} ({len(name_map)} entries)")

        except Exception as e:
            logger.error(f"❌ Error processing API file {file_path.name}: {e}")

    return generated_files

def generate_name_loader(files: List[str]) -> None:
    """Generates 'name_loader.js' inside assets/sutta/."""
    if not files:
        return

    # Sort để đảm bảo thứ tự load đẹp mắt (an, dn... kn/dhp...)
    files.sort()
    
    loader_path = OUTPUT_SUTTA_BASE / "name_loader.js"
    
    js_content = f"""
// Auto-generated Name Loader
(function() {{
    const files = {json.dumps(files, indent=2)};
    // Script này nằm tại assets/sutta/name_loader.js
    // basePath sẽ trỏ vào assets/sutta/names/
    const basePath = document.currentScript.src.replace('name_loader.js', 'names/');
    
    files.forEach(file => {{
        const script = document.createElement('script');
        // file đã chứa relative path (vd: "kn/dhp-name.js" hoặc "mn-name.js")
        // nên nối vào basePath là chuẩn: ".../names/kn/dhp-name.js"
        script.src = basePath + file;
        script.async = false;
        document.head.appendChild(script);
    }});
}})();
"""
    with open(loader_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    logger.info("✅ Generated Name Loader: name_loader.js")