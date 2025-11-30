# Path: tools/sutta_processor/manager.py
import json
import logging
import os
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict

from .config import OUTPUT_BASE_DIR, OUTPUT_BOOKS_DIR, PROCESS_LIMIT
from .finder import scan_root_dir
from .converter import process_worker

logger = logging.getLogger("SuttaProcessor")

class SuttaManager:
    def __init__(self):
        self.collections: Dict[str, Dict[str, str]] = {}

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
                    if group not in self.collections:
                        self.collections[group] = {}
                    self.collections[group][sid] = content
                
                count += 1
                if count % 500 == 0:
                    logger.info(f"   Processed {count}/{len(tasks)}...")

        # 3. Output
        self._write_files()

    def _write_files(self):
        logger.info("💾 Writing output files...")
        
        # Reset Directories
        if OUTPUT_BASE_DIR.exists():
            shutil.rmtree(OUTPUT_BASE_DIR)
        
        OUTPUT_BASE_DIR.mkdir(parents=True, exist_ok=True)
        OUTPUT_BOOKS_DIR.mkdir(parents=True, exist_ok=True)

        generated_files = []

        # Write Book Files (Prettified)
        for group_name, data in self.collections.items():
            file_name = f"{group_name}.js"
            file_path = OUTPUT_BOOKS_DIR / file_name
            
            # Ensure subfolders exist (for kn/dhp etc)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # PRETTIFY: indent=2 ensures readability
            json_str = json.dumps(data, ensure_ascii=False, indent=2)
            
            js_content = f"""// Source: {group_name}
window.SUTTA_DB = window.SUTTA_DB || {{}};
Object.assign(window.SUTTA_DB, {json_str});
"""
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(js_content)
            
            generated_files.append(file_name)
            logger.info(f"   -> {file_name} ({len(data)} items)")

        # Write Loader
        self._write_loader(generated_files)
        logger.info("✅ All done.")

    def _write_loader(self, files: list):
        files.sort()
        loader_path = OUTPUT_BASE_DIR / "loader.js"
        
        # Loader logic: Append "books/" to the filename
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