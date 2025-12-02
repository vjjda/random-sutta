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
        
        # Output config
        if self.dry_run:
            logger.info("🧪 RUNNING IN DRY-RUN MODE")
            self.output_base = PROCESSED_DIR
            self.json_indent = 2
        else:
            logger.info("🚀 RUNNING IN PRODUCTION MODE")
            self.output_base = OUTPUT_SUTTA_BOOKS
            self.json_indent = None

        # State management cho Map-Reduce
        self.buffers: Dict[str, Dict[str, Any]] = {} # Chứa dữ liệu đang xử lý: {'sutta/mn': {'mn1': ...}}
        self.book_totals: Dict[str, int] = {}        # Tổng số bài cần xử lý mỗi cuốn: {'sutta/mn': 152}
        self.book_progress: Dict[str, int] = {}      # Tiến độ hiện tại: {'sutta/mn': 50}
        self.completed_books: List[str] = []

    def run(self):
        self._prepare_output_dir()

        # 1. PLAN: Lấy danh sách task và tính toán tổng số lượng
        book_tasks = generate_book_tasks(limit=PROCESS_LIMIT)
        
        all_tasks = []
        for group_name, tasks in book_tasks.items():
            self.book_totals[group_name] = len(tasks)
            self.book_progress[group_name] = 0
            self.buffers[group_name] = {}
            all_tasks.extend(tasks) # Flatten thành 1 list duy nhất

        workers = os.cpu_count() or 4
        logger.info(f"🚀 Processing {len(all_tasks)} items from {len(book_tasks)} books with {workers} workers...")

        # 2. EXECUTE: Xử lý song song toàn cục
        with ProcessPoolExecutor(max_workers=workers) as executor:
            # Submit tất cả tasks một lúc
            futures = [executor.submit(process_worker, task) for task in all_tasks]
            
            # 3. ACCUMULATE & FLUSH: Nhận kết quả dần dần
            for i, future in enumerate(as_completed(futures)):
                group, sid, content = future.result()
                
                # Bỏ qua các bài lỗi/skipped
                if not content:
                    # Vẫn phải tăng progress để biết là đã xử lý xong (dù fail)
                    self._update_progress_and_flush_if_ready(group)
                    continue

                # Lưu vào buffer
                self.buffers[group][sid] = content
                
                # Check xem cuốn sách này đã đủ chưa -> Ghi đĩa
                self._update_progress_and_flush_if_ready(group)

                # Log tiến độ tổng (mỗi 500 bài)
                if (i + 1) % 500 == 0:
                    logger.info(f"   Processed {i + 1}/{len(all_tasks)} total items...")

        # 4. FINISH
        if not self.dry_run:
            self._write_loader(self.completed_books)
        
        logger.info(f"✅ All done. Output: {self.output_base}")

    def _update_progress_and_flush_if_ready(self, group: str):
        """Cập nhật tiến độ của một cuốn sách và ghi đĩa nếu nó đã hoàn thành."""
        self.book_progress[group] += 1
        
        # Nếu đã xử lý đủ số lượng bài của sách này
        if self.book_progress[group] >= self.book_totals[group]:
            if self.buffers[group]: # Chỉ ghi nếu có dữ liệu (tránh sách rỗng toàn bộ)
                generated_file = self._write_single_book(group, self.buffers[group])
                self.completed_books.append(generated_file)
            
            # QUAN TRỌNG: Xóa khỏi RAM ngay lập tức
            del self.buffers[group]

    def _prepare_output_dir(self):
        if self.output_base.exists():
            shutil.rmtree(self.output_base)
        self.output_base.mkdir(parents=True, exist_ok=True)

    def _write_single_book(self, group_name: str, raw_data: Dict[str, Any]) -> str:
        """Ghi file sách (JSON/JS) và trả về tên file."""
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

        # Tạo file path: data/processed/sutta/mn.json
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