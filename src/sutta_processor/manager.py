# Path: src/sutta_processor/manager.py
import json
import logging
import os
import shutil
import re
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any

# Đảm bảo import sạch (đã sửa từ bước trước)
from .config import OUTPUT_SUTTA_BASE, OUTPUT_SUTTA_BOOKS, PROCESS_LIMIT
from .finder import scan_root_dir
from .converter import process_worker
from .name_parser import load_names_map 

logger = logging.getLogger("SuttaProcessor")

def natural_sort_key(s: str) -> List[Any]:
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split(r'(\d+)', s)]

class SuttaManager:
    def __init__(self):
        self.raw_collections: Dict[str, Dict[str, str]] = {}
        self.names_map = load_names_map()

    def run(self):
        tasks = scan_root_dir(limit=PROCESS_LIMIT)
        workers = os.cpu_count() or 4
        logger.info(f"Processing content with {workers} workers...")
        
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

        self._write_files()
        logger.info("✅ All done.")

    def _write_files(self):
        logger.info("💾 Linking suttas and writing Combined DB files...")
        
        if OUTPUT_SUTTA_BASE.exists():
            shutil.rmtree(OUTPUT_SUTTA_BASE)
        
        OUTPUT_SUTTA_BASE.mkdir(parents=True, exist_ok=True)
        OUTPUT_SUTTA_BOOKS.mkdir(parents=True, exist_ok=True)

        generated_files = []

        for group_name, raw_data in self.raw_collections.items():
            sorted_sids = sorted(raw_data.keys(), key=natural_sort_key)
            linked_data = {}
            total_suttas = len(sorted_sids)
            
            for i, sid in enumerate(sorted_sids):
                prev_id = sorted_sids[i-1] if i > 0 else None
                next_id = sorted_sids[i+1] if i < total_suttas - 1 else None
                
                name_info = self.names_map.get(sid, {
                    "acronym": "",
                    "translated_title": "",
                    "original_title": ""
                })

                linked_data[sid] = {
                    "previous": prev_id,
                    "next": next_id,
                    "content": raw_data[sid],
                    "acronym": name_info["acronym"],
                    "translated_title": name_info["translated_title"],
                    "original_title": name_info["original_title"]
                }

            file_name = f"{group_name}.js"
            file_path = OUTPUT_SUTTA_BOOKS / file_name
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
        loader_path = OUTPUT_SUTTA_BASE / "sutta_loader.js"
        
        # --- THAY ĐỔI LOGIC TẠI ĐÂY ---
        # Chỉ xuất ra biến Global chứa danh sách file
        js_content = f"""// Auto-generated Sutta Manifest
window.ALL_SUTTA_FILES = {json.dumps(files, indent=2)};
"""
        with open(loader_path, "w", encoding="utf-8") as f:
            f.write(js_content)
        
        logger.info("✅ Generated Sutta Manifest: sutta_loader.js")