# Path: src/sutta_processor/manager.py
import json
import logging
import os
import shutil
import re
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any

from .config import OUTPUT_BASE_DIR, OUTPUT_BOOKS_DIR, PROCESS_LIMIT
from .finder import scan_root_dir
from .converter import process_worker
# UPDATED: Import name processor
from .name_parser import process_names, generate_name_loader

logger = logging.getLogger("SuttaProcessor")

def natural_sort_key(s: str) -> List[Any]:
    """
    Splits string into a list of integers and strings for natural sorting.
    e.g., "mn12" -> ['mn', 12]
    e.g., "an1.1-10" -> ['an', 1, '.', 1, '-', 10]
    """
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split(r'(\d+)', s)]

class SuttaManager:
    def __init__(self):
        # Raw content storage: { 'mn': { 'mn1': '<html>...' } }
        self.raw_collections: Dict[str, Dict[str, str]] = {}

    def run(self):
        # 1. Prepare
        tasks = scan_root_dir(limit=PROCESS_LIMIT)
        
        # 2. Execute Parallel Processing
        workers = os.cpu_count() or 4
        logger.info(f"Processing with {workers} workers...")
        
        with ProcessPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(process_worker, task) for task in tasks]
 
            count = 0
            for future in as_completed(futures):
                group, sid, content = future.result()
                if content:
                    if group not in self.raw_collections:
                        self.raw_collections[group] = {}
                    self.raw_collections[group][sid] = content
                
                count += 1
                if count % 500 == 0:
                    logger.info(f"   Processed {count}/{len(tasks)}...")

        # 3. Process Linking & Output
        self._write_files()
        
        # 4. UPDATED: Process Names
        logger.info("🏷️  Processing Sutta Names...")
        name_files = process_names()
        generate_name_loader(name_files)

        logger.info("✅ All done.")

    def _write_files(self):
        logger.info("💾 Linking suttas and writing output files...")
        
        if OUTPUT_BASE_DIR.exists():
            # Warning: This deletes everything, including the new 'names' dir if it was created before
            # But since names are processed AFTER this function in run(), it's fine.
            # Ideally, we should be careful not to delete 'names' if we run partial updates.
            # For now, let's keep it simple: Wipe clean.
            shutil.rmtree(OUTPUT_BASE_DIR)
        
        OUTPUT_BASE_DIR.mkdir(parents=True, exist_ok=True)
        OUTPUT_BOOKS_DIR.mkdir(parents=True, exist_ok=True)

        generated_files = []

        for group_name, raw_data in self.raw_collections.items():
            # 1. Sort IDs naturally
            sorted_sids = sorted(raw_data.keys(), key=natural_sort_key)
            
            # 2. Build Linked Data
            linked_data = {}
            total_suttas = len(sorted_sids)
            
            for i, sid in enumerate(sorted_sids):
                prev_id = sorted_sids[i-1] if i > 0 else None
                next_id = sorted_sids[i+1] if i < total_suttas - 1 else None
                
                linked_data[sid] = {
                    "previous": prev_id,
                    "next": next_id,
                    "content": raw_data[sid]
                }

            # 3. Write File
            file_name = f"{group_name}.js"
            file_path = OUTPUT_BOOKS_DIR / file_name
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            json_str = json.dumps(linked_data, ensure_ascii=False, indent=2)
           
            js_content = f"""// Source: {group_name}
window.SUTTA_DB = window.SUTTA_DB || {{}};
Object.assign(window.SUTTA_DB, {json_str});
"""
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(js_content)
            
            generated_files.append(file_name)
            logger.info(f"   -> {file_name} ({len(linked_data)} items)")

        self._write_loader(generated_files)

    def _write_loader(self, files: list):
        files.sort()
        loader_path = OUTPUT_BASE_DIR / "loader.js" # This is the main book loader
        
        js_content = f"""
// Auto-generated Loader
(function() {{
    const files = {json.dumps(files, indent=2)};
    const basePath = document.currentScript.src.replace('loader.js', 'books/');
    
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