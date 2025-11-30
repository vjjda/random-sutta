#!/usr/bin/env python3
# Path: tools/sutta_processor.py
import json
import logging
import re
import sys
import os
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
from concurrent.futures import ProcessPoolExecutor, as_completed

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"
OUTPUT_FILE = PROJECT_ROOT / "data" / "sutta_db.js"

# Limit processing for testing (Set to 0 for unlimited)
PROCESS_LIMIT = 0 

# --- Logging Setup ---
# Configure logging to work nicely with multiprocessing
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("SuttaProcessor")

def load_json(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        # Print error directly as logger might not sync perfectly in processes without complex setup
        print(f"⚠️ Error reading {path}: {e}")
        return {}

def find_sutta_files(sutta_id: str) -> Dict[str, Path]:
    """Finds the 4 component files for a given sutta_id."""
    # Note: Optimization possibility - Scan all dirs once and map them instead of rglob per ID.
    # But for now, rglob in parallel processes is fast enough.
    files = {}
    
    # 1. Root (Pali)
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

def process_single_worker(sutta_id: str) -> Tuple[str, Optional[str]]:
    """
    Worker function to be run in a separate process.
    Returns (sutta_id, html_content) or (sutta_id, None) if failed/skipped.
    """
    try:
        files = find_sutta_files(sutta_id)
        if not files.get('root') or not files.get('html'):
            return sutta_id, None

        data_root = load_json(files['root'])
        data_trans = load_json(files['translation']) if files['translation'] else {}
        data_html = load_json(files['html']) if files['html'] else {}
        data_comment = load_json(files['comment']) if files['comment'] else {}

        # Sort keys naturally
        sorted_keys = sorted(data_html.keys(), key=lambda x: [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', x)])

        final_html = ""
        for key in sorted_keys:
            template = data_html.get(key, "{}")
            pali_text = data_root.get(key, "")
            eng_text = data_trans.get(key, "")
            comment_text = data_comment.get(key, "")

            segment_content = ""
            
            if pali_text:
                segment_content += f"<span class='pli'>{pali_text}</span>"
            
            if eng_text:
                segment_content += f" <span class='eng'>{eng_text}</span>"
                
            if comment_text:
                safe_comment = comment_text.replace('"', '&quot;').replace("'", "&#39;")
                segment_content += f" <span class='comment-marker' title='{safe_comment}'>[*]</span>"

            rendered_segment = template.replace("{}", segment_content)
            final_html += rendered_segment + "\n"

        return sutta_id, final_html

    except Exception as e:
        print(f"❌ Error processing {sutta_id}: {e}")
        return sutta_id, None

def orchestrate_processing():
    logger.info("🚀 Starting Sutta Processing (Multiprocessed)...")
    
    root_dir = DATA_ROOT / "root"
    if not root_dir.exists():
        logger.error("❌ Data directory missing.")
        sys.exit(1)

    # 1. Discover Suttas
    logger.info("Scanning for suttas...")
    sutta_ids = []
    for file_path in root_dir.rglob("*_root-*.json"):
        sutta_id = file_path.name.split("_")[0]
        sutta_ids.append(sutta_id)
    
    sutta_ids = sorted(list(set(sutta_ids)))
    
    total_suttas = len(sutta_ids)
    if PROCESS_LIMIT > 0:
        sutta_ids = sutta_ids[:PROCESS_LIMIT]
        total_suttas = len(sutta_ids)
        
    logger.info(f"Found {len(sutta_ids)} suttas to process.")

    # 2. Process in Parallel
    db = {}
    workers_count = os.cpu_count() or 4
    logger.info(f"🔥 Spawning {workers_count} worker processes...")

    with ProcessPoolExecutor(max_workers=workers_count) as executor:
        # Submit all tasks
        future_to_sutta = {executor.submit(process_single_worker, sid): sid for sid in sutta_ids}
        
        completed_count = 0
        for future in as_completed(future_to_sutta):
            sid, html_content = future.result()
            if html_content:
                db[sid] = html_content
            
            completed_count += 1
            if completed_count % 100 == 0:
                logger.info(f"   Progress: {completed_count}/{total_suttas} suttas processed...")

    # 3. Write output
    logger.info(f"💾 Writing {len(db)} suttas to {OUTPUT_FILE}...")
    js_content = f"const SUTTA_DB = {json.dumps(db, ensure_ascii=False)};" # Removed indent for smaller file size
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(js_content)
    
    logger.info("✅ Done.")

if __name__ == "__main__":
    # Windows requires this protection for multiprocessing
    orchestrate_processing()