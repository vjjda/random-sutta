# Path: src/sutta_processor/manager.py
import json
import logging
import os
import shutil
import re
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any
from pathlib import Path

from .config import (
    OUTPUT_SUTTA_BASE, 
    OUTPUT_SUTTA_BOOKS, 
    PROCESSED_DIR,
    PROCESS_LIMIT
)
from .finder import generate_book_tasks
from .converter import process_worker
from .name_parser import load_names_map 

logger = logging.getLogger("SuttaProcessor")

def natural_sort_key(s: str) -> List[Any]:
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split(r'(\d+)', s)]

class SuttaManager:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.names_map = load_names_map()
        
        if self.dry_run:
            logger.info("🧪 RUNNING IN DRY-RUN MODE")
            self.output_base = PROCESSED_DIR
            self.json_indent = 2
        else:
            logger.info("🚀 RUNNING IN PRODUCTION MODE")
            self.output_base = OUTPUT_SUTTA_BOOKS
            self.json_indent = None

        self.buffers: Dict[str, Dict[str, Any]] = {} 
        self.book_totals: Dict[str, int] = {}       
        self.book_progress: Dict[str, int] = {}      
        self.completed_books: List[str] = []
        
        # Map ngược: sutta_id -> group (để handle trường hợp worker trả về 'skipped')
        self.sutta_group_map: Dict[str, str] = {}

    def run(self):
        self._prepare_output_dir()

        book_tasks = generate_book_tasks(limit=PROCESS_LIMIT)
        
        all_tasks = []
        for group_name, tasks in book_tasks.items():
            self.book_totals[group_name] = len(tasks)
            self.book_progress[group_name] = 0
            self.buffers[group_name] = {}
            
            for sutta_id, path in tasks:
                all_tasks.append((sutta_id, path))
                # Lưu mapping để tra cứu khi worker bị skip
                self.sutta_group_map[sutta_id] = group_name

        # Tăng số lượng worker lên tối đa có thể để ép xung CPU
        # Sutta processing là CPU-bound (regex, json parse) nên càng nhiều core càng tốt
        workers = os.cpu_count() or 4
        logger.info(f"🚀 Processing {len(all_tasks)} items from {len(book_tasks)} books with {workers} workers...")

        with ProcessPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(process_worker, task) for task in all_tasks]
            
            for i, future in enumerate(as_completed(futures)):
                try:
                    res_group, res_sid, content = future.result()
                    
                    # Xác định group đúng:
                    # Nếu res_group là "skipped" hoặc "error", ta dùng map để tìm group gốc
                    target_group = self.sutta_group_map.get(res_sid)
                    
                    if not target_group:
                        logger.warning(f"⚠️ Unknown group for {res_sid} (result: {res_group})")
                        continue

                    # Nếu thành công (có content), lưu vào buffer
                    if content:
                        self.buffers[target_group][res_sid] = content
                    else:
                        # Log nhẹ nếu skip để biết
                        # logger.debug(f"Skipped: {res_sid}")
                        pass

                    # Cập nhật tiến độ cho group gốc
                    self._update_progress_and_flush_if_ready(target_group)

                except Exception as e:
                    logger.error(f"❌ Worker exception: {e}")

                if (i + 1) % 1000 == 0:
                    logger.info(f"   Processed {i + 1}/{len(all_tasks)} total items...")

        if not self.dry_run:
            self._write_loader(self.completed_books)
        
        logger.info(f"✅ All done. Output: {self.output_base}")

    def _update_progress_and_flush_if_ready(self, group: str):
        self.book_progress[group] += 1
        
        if self.book_progress[group] >= self.book_totals[group]:
            if self.buffers.get(group): 
                generated_file = self._write_single_book(group, self.buffers[group])
                self.completed_books.append(generated_file)
            else:
                logger.warning(f"⚠️ Book {group} completed but buffer empty (all skipped?)")
            
            # Clean RAM
            if group in self.buffers:
                del self.buffers[group]

    def _prepare_output_dir(self):
        if self.output_base.exists():
            shutil.rmtree(self.output_base)
        self.output_base.mkdir(parents=True, exist_ok=True)

    def _write_single_book(self, group_name: str, raw_data: Dict[str, Any]) -> str:
        sorted_sids = sorted(raw_data.keys(), key=natural_sort_key)
        linked_data = {}
        
        for sid in sorted_sids:
            name_info = self.names_map.get(sid, {
                "acronym": "",
                "translated_title": "",
                "original_title": ""
            })

            linked_data[sid] = {
                "acronym": name_info["acronym"],
                "translated_title": name_info["translated_title"],
                "original_title": name_info["original_title"],
                "content": raw_data[sid] 
            }

        if self.dry_run:
            file_name = f"{group_name}.json"
            file_path = self.output_base / file_name
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(linked_data, f, ensure_ascii=False, indent=self.json_indent)
        else:
            file_name = f"{group_name}.js"
            file_path = self.output_base / file_name
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            json_str = json.dumps(linked_data, ensure_ascii=False, indent=self.json_indent)
            safe_group = group_name.replace("/", "_")
            js_content = f"window.SUTTA_DB = window.SUTTA_DB || {{}}; Object.assign(window.SUTTA_DB, {json_str});"
            
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(js_content)
        
        logger.info(f"   💾 Saved: {file_name} ({len(linked_data)} items)")
        return file_name

    def _write_loader(self, files: list):
        files.sort()
        loader_path = OUTPUT_SUTTA_BASE / "sutta_loader.js"
        js_content = f"window.ALL_SUTTA_FILES = {json.dumps(files, indent=2)};\n"
        with open(loader_path, "w", encoding="utf-8") as f:
            f.write(js_content)