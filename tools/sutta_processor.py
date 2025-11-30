#!/usr/bin/env python3
# Path: tools/sutta_processor.py
import json
import logging
import re
import sys
from pathlib import Path
from typing import Dict, Any, List

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"
OUTPUT_FILE = PROJECT_ROOT / "data" / "sutta_db.js"

# Limit processing for testing (Set to 0 for unlimited)
# Warning: Full processing might create a very large JS file.
PROCESS_LIMIT = 0 

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("SuttaProcessor")

def load_json(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"⚠️ Error reading {path}: {e}")
        return {}

def find_sutta_files(sutta_id: str) -> Dict[str, Path]:
    """Finds the 4 component files for a given sutta_id."""
    # Heuristic: We look into subfolders recursively
    files = {}
    
    # 1. Root (Pali) - Source of Truth for ID
    root_matches = list((DATA_ROOT / "root").rglob(f"{sutta_id}_root-*.json"))
    if not root_matches:
        return {}
    files['root'] = root_matches[0]
    
    # 2. Translation (English)
    trans_matches = list((DATA_ROOT / "translation").rglob(f"{sutta_id}_translation-en-*.json"))
    files['translation'] = trans_matches[0] if trans_matches else None
    
    # 3. HTML (Structure)
    html_matches = list((DATA_ROOT / "html").rglob(f"{sutta_id}_html.json"))
    files['html'] = html_matches[0] if html_matches else None

    # 4. Comment
    comment_matches = list((DATA_ROOT / "comment").rglob(f"{sutta_id}_comment-*.json"))
    files['comment'] = comment_matches[0] if comment_matches else None

    return files

def process_sutta(sutta_id: str) -> str:
    """Merges the components into a single HTML string."""
    files = find_sutta_files(sutta_id)
    if not files.get('root') or not files.get('html'):
        # Skip if no root or no structure
        return ""

    data_root = load_json(files['root'])
    data_trans = load_json(files['translation']) if files['translation'] else {}
    data_html = load_json(files['html']) if files['html'] else {}
    data_comment = load_json(files['comment']) if files['comment'] else {}

    # We iterate based on HTML keys to preserve the structure order
    # Sorting keys naturally (mn1:1.1, mn1:1.2...)
    sorted_keys = sorted(data_html.keys(), key=lambda x: [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', x)])

    final_html = ""

    for key in sorted_keys:
        template = data_html.get(key, "{}")
        pali_text = data_root.get(key, "")
        eng_text = data_trans.get(key, "")
        comment_text = data_comment.get(key, "")

        # Logic: If English exists, show both. If not, just Pali.
        segment_content = ""
        
        if pali_text:
            segment_content += f"<span class='pli'>{pali_text}</span>"
        
        if eng_text:
            # Add a break or space between Pali and English
            segment_content += f" <span class='eng'>{eng_text}</span>"
            
        if comment_text:
            # Add a simple tooltip indicator
            # Escape quotes in comment to avoid breaking HTML attributes
            safe_comment = comment_text.replace('"', '&quot;').replace("'", "&#39;")
            segment_content += f" <span class='comment-marker' title='{safe_comment}'>[*]</span>"

        # Inject content into the HTML template
        # Using replace instead of format to avoid issues if text contains {}
        rendered_segment = template.replace("{}", segment_content)
        final_html += rendered_segment + "\n"

    return final_html

def orchestrate_processing():
    logger.info("🚀 Starting Sutta Processing...")
    
    # 1. Discover Suttas (Scan root folder)
    # This might find thousands.
    root_dir = DATA_ROOT / "root"
    if not root_dir.exists():
        logger.error("❌ Data directory missing. Please run fetcher first.")
        sys.exit(1)

    sutta_ids = []
    # Find all json files in root, extract ID prefix (e.g. 'mn1' from 'mn1_root-pli-ms.json')
    for file_path in root_dir.rglob("*_root-*.json"):
        sutta_id = file_path.name.split("_")[0]
        sutta_ids.append(sutta_id)
    
    # De-duplicate and sort
    sutta_ids = sorted(list(set(sutta_ids)))
    
    logger.info(f"Found {len(sutta_ids)} potential suttas.")

    # 2. Process
    db = {}
    count = 0
    
    for sid in sutta_ids:
        if PROCESS_LIMIT > 0 and count >= PROCESS_LIMIT:
            break
            
        logger.info(f"Processing: {sid}...")
        html_content = process_sutta(sid)
        if html_content:
            db[sid] = html_content
            count += 1

    # 3. Write output
    logger.info(f"💾 Writing {len(db)} suttas to {OUTPUT_FILE}...")
    
    js_content = f"const SUTTA_DB = {json.dumps(db, ensure_ascii=False, indent=2)};"
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(js_content)
    
    logger.info("✅ Done.")

if __name__ == "__main__":
    orchestrate_processing()