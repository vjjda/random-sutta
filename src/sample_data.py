# Path: src/sample_data.py
import json
import logging
import sys
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent
DATA_BILARA = PROJECT_ROOT / "data" / "bilara"
DATA_JSON = PROJECT_ROOT / "data" / "json"
OUTPUT_DIR = PROJECT_ROOT 

# --- Logging ---
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("SampleData")

def get_book_id(sutta_id: str) -> str:
    """
    Trích xuất ID sách từ ID bài kinh.
    Ví dụ: 'mn1' -> 'mn', 'an1.1' -> 'an', 'dhp1' -> 'dhp'
    """
    match = re.match(r"^([a-z]+)", sutta_id.lower())
    return match.group(1) if match else sutta_id

def _find_bilara_files(sutta_id: str) -> List[Path]:
    """Tìm tất cả các file nội dung trong data/bilara khớp với sutta_id."""
    if not DATA_BILARA.exists():
        logger.warning(f"⚠️ Bilara data directory not found: {DATA_BILARA}")
        return []

    # Sử dụng rglob để tìm kiếm đệ quy trong mọi ngóc ngách của thư mục data/bilara
    # Pattern khớp với quy ước đặt tên của Bilara: {uid}_*.json
    pattern = f"{sutta_id}_*.json"
    found_files = list(DATA_BILARA.rglob(pattern))
    
    return sorted(found_files)

def _find_metadata_entry(sutta_id: str) -> Optional[Dict[str, Any]]:
    """Tìm và trích xuất thông tin metadata cụ thể từ data/json."""
    book_id = get_book_id(sutta_id)
    
    if not DATA_JSON.exists():
        return None

    # Tìm file json của sách (ví dụ mn.json). 
    # Dùng rglob vì file có thể nằm sâu trong sutta/kn/dhp.json
    metadata_files = list(DATA_JSON.rglob(f"{book_id}.json"))
    
    if not metadata_files:
        return None
    
    file_path = metadata_files[0]
    result = {"source": file_path, "data": None}

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Dữ liệu API thường là một list các suttaplex object
        if isinstance(data, list):
            for item in data:
                # Tìm mục có uid khớp với sutta_id
                if item.get("uid") == sutta_id:
                    result["data"] = item
                    return result
        
        # Nếu không tìm thấy uid cụ thể, báo lại là tìm thấy file sách nhưng không thấy bài
        result["data"] = f"Entry '{sutta_id}' not found in {file_path.name}"
        return result

    except Exception as e:
        result["data"] = f"Error reading metadata: {e}"
        return result

def _format_json(data: Any) -> str:
    """Format JSON đẹp để in ra file text."""
    return json.dumps(data, indent=2, ensure_ascii=False)

def _generate_report(sutta_id: str):
    logger.info(f"🔍 Generating sample report for '{sutta_id}'...")
    
    bilara_files = _find_bilara_files(sutta_id)
    metadata_info = _find_metadata_entry(sutta_id)
    
    output_lines = []
    output_lines.append("=" * 80)
    output_lines.append(f" SAMPLE DATA REPORT: {sutta_id}")
    output_lines.append("=" * 80)
    output_lines.append(f"Generated at: {PROJECT_ROOT}")
    
    # 1. Metadata Section
    output_lines.append("\n" + ">" * 20 + " METADATA (JSON) " + "<" * 20)
    if metadata_info:
        rel_path = metadata_info['source'].relative_to(PROJECT_ROOT)
        output_lines.append(f"Source: {rel_path}")
        output_lines.append("-" * 40)
        output_lines.append(_format_json(metadata_info['data']))
    else:
        output_lines.append(f"[!] Metadata file for book '{get_book_id(sutta_id)}' not found in {DATA_JSON}")

    # 2. Bilara Content Section
    output_lines.append("\n" + ">" * 20 + f" CONTENT FILES ({len(bilara_files)}) " + "<" * 20)
    
    if not bilara_files:
         output_lines.append(f"[!] No content files found in {DATA_BILARA}")

    for file_path in bilara_files:
        try:
            rel_path = file_path.relative_to(PROJECT_ROOT)
            with open(file_path, "r", encoding="utf-8") as f:
                content = json.load(f)
            
            output_lines.append("\n" + "-" * 80)
            output_lines.append(f"FILE: {rel_path}")
            output_lines.append("-" * 80)
            output_lines.append(_format_json(content))
        except Exception as e:
            output_lines.append(f"Error reading {file_path}: {e}")

    # Write to file
    output_file = OUTPUT_DIR / f"sample_{sutta_id}.txt"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines))
    
    logger.info(f"✅ Report saved to: {output_file.name}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 src/sample_data.py <sutta_id_1> [sutta_id_2 ...]")
        print("Example: python3 src/sample_data.py mn1 an1.1")
        sys.exit(1)
        
    for sutta_id in sys.argv[1:]:
        _generate_report(sutta_id)

if __name__ == "__main__":
    main()