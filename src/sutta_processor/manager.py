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
from .finder import generate_book_tasks  # Import hàm mới
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
        
        # Output config
        if self.dry_run:
            logger.info("🧪 RUNNING IN DRY-RUN MODE")
            self.output_base = PROCESSED_DIR
            self.json_indent = 2
        else:
            logger.info("🚀 RUNNING IN PRODUCTION MODE")
            self.output_base = OUTPUT_SUTTA_BOOKS
            self.json_indent = None

    def run(self):
        self._prepare_output_dir()

        # 1. Lấy danh sách tasks đã được nhóm theo Book
        # book_collections = { 'sutta/mn': [task1, task2...], ... }
        book_collections = generate_book_tasks(limit=PROCESS_LIMIT)
        
        workers = os.cpu_count() or 4
        all_generated_files = []

        # 2. Xử lý từng cuốn sách (Book-by-Book Processing)
        # Đây là bước tối ưu bộ nhớ: Xử lý xong sách nào, giải phóng sách đó.
        total_books = len(book_collections)
        current_book_idx = 0

        with ProcessPoolExecutor(max_workers=workers) as executor:
            for group_name, tasks in book_collections.items():
                current_book_idx += 1
                logger.info(f"📚 [{current_book_idx}/{total_books}] Processing {group_name} ({len(tasks)} items)...")
                
                # Submit tasks cho sách hiện tại
                futures = [executor.submit(process_worker, task) for task in tasks]
                
                # Thu thập kết quả của sách này
                book_data = {}
                for future in as_completed(futures):
                    _, sid, content = future.result()
                    if content:
                        book_data[sid] = content
                
                # Ghi file ngay lập tức
                if book_data:
                    generated_file = self._write_single_book(group_name, book_data)
                    all_generated_files.append(generated_file)
                    
                # Python sẽ tự động giải phóng biến book_data và futures ở đây

        # 3. Kết thúc
        if not self.dry_run:
            self._write_loader(all_generated_files)
        
        logger.info(f"✅ All done. Output: {self.output_base}")

    def _prepare_output_dir(self):
        if self.output_base.exists():
            shutil.rmtree(self.output_base)
        self.output_base.mkdir(parents=True, exist_ok=True)

    def _write_single_book(self, group_name: str, raw_data: Dict[str, Any]) -> str:
        """Ghi một file sách duy nhất."""
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

        # Xác định tên file và path
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
            # Normalize group name for JS comment (sutta/mn -> sutta_mn)
            safe_group = group_name.replace("/", "_")
            js_content = f"window.SUTTA_DB = window.SUTTA_DB || {{}}; Object.assign(window.SUTTA_DB, {json_str});"
            
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(js_content)
        
        logger.info(f"   -> Saved {file_name}")
        return file_name

    def _write_loader(self, files: list):
        files.sort()
        loader_path = OUTPUT_SUTTA_BASE / "sutta_loader.js"
        js_content = f"window.ALL_SUTTA_FILES = {json.dumps(files, indent=2)};\n"
        with open(loader_path, "w", encoding="utf-8") as f:
            f.write(js_content)