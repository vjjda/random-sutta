# Path: src/sample_data.py
import json
import logging
import sys
from pathlib import Path
from typing import List, Dict, Any


PROJECT_ROOT = Path(__file__).parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"
OUTPUT_DIR = PROJECT_ROOT 
TARGET_DIRS = ["root", "translation", "html", "comment"]


logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'
)
logger = logging.getLogger("SampleData")



def _find_files_for_sutta(sutta_id: str) -> List[Path]:
    found_files = []
    
    
    if not DATA_ROOT.exists():
        logger.error(f"❌ Data directory not found: {DATA_ROOT}")
        return []

    for category in TARGET_DIRS:
        search_path = DATA_ROOT / category
        if not search_path.exists():
            continue
            
        
        
        pattern = f"{sutta_id}_*.json"
        
        
        files = list(search_path.rglob(pattern))
        found_files.extend(files)
        
    return sorted(found_files)

def _read_and_format_file(file_path: Path) -> str:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        
        try:
            rel_path = file_path.relative_to(PROJECT_ROOT)
        except ValueError:
            rel_path = file_path

        output = []
        output.append("=" * 60)
        output.append(f"FILE: {rel_path}")
        output.append("-" * 60)
        output.append(json.dumps(data, indent=2, ensure_ascii=False))
        output.append("\n") 
        return "\n".join(output)
        
    except Exception as e:
        return f"❌ Error reading {file_path}: {e}\n"

def _generate_sample_report(sutta_id: str) -> None:
    logger.info(f"🔍 Searching for '{sutta_id}' in {DATA_ROOT}...")
    
    files = _find_files_for_sutta(sutta_id)
    
    if not files:
        logger.warning(f"⚠️  No files found for sutta_id: '{sutta_id}'")
        return

    output_filename = OUTPUT_DIR / f"sample_{sutta_id}.txt"
    
    with open(output_filename, "w", encoding="utf-8") as f:
        f.write(f"SAMPLE DATA REPORT FOR: {sutta_id}\n")
        f.write(f"Generated at: {PROJECT_ROOT}\n")
        f.write("\n")
        
        for file_path in files:
            content = _read_and_format_file(file_path)
            f.write(content)
            logger.info(f"   found: {file_path.name}")

    logger.info(f"✅ Generated: {output_filename.name}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/sample_data.py <sutta_id_1> <sutta_id_2> ...")
        print("Example: python tools/sample_data.py mn1 an1.1-10")
        sys.exit(1)

    sutta_ids = sys.argv[1:]
    
    print(f"🚀 Starting sample extraction for: {sutta_ids}")
    for sutta_id in sutta_ids:
        _generate_sample_report(sutta_id)
    print("✨ Done.")

if __name__ == "__main__":
    main()