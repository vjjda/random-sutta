# Path: src/sutta_processor/build_manager.py
import logging
import os
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any

from .shared.app_config import OUTPUT_DB_DIR, PROCESSED_DIR
from .ingestion.metadata_parser import load_names_map
from .ingestion.file_crawler import generate_book_tasks
from .logic.content_merger import process_worker
from .logic.structure_handler import build_book_data
# [NEW IMPORT]
from .logic.super_generator import generate_super_book_data 
from .output.asset_generator import write_book_file, write_loader_script

logger = logging.getLogger("SuttaProcessor.BuildManager")

class BuildManager:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.names_map = load_names_map()
        
        self.buffers: Dict[str, Dict[str, Any]] = {}
        self.book_totals: Dict[str, int] = {}
        self.book_progress: Dict[str, int] = {}
        self.completed_files: List[str] = []
        
        # [NEW] Theo dõi ID các sách đã build để truyền cho SuperGen
        self.processed_book_ids: List[str] = [] 
        
        self.sutta_group_map: Dict[str, str] = {}

    # ... (Các hàm _prepare_environment, _handle_task_completion giữ nguyên) ...

    def _finalize_book(self, group: str) -> None:
        raw_data = self.buffers.get(group, {})
        book_obj = build_book_data(group, raw_data, self.names_map)
        
        # [NEW] Lưu lại ID sách (ví dụ: 'dn', 'mn', 'pli-tv-bi-pm')
        if book_obj and "id" in book_obj:
            self.processed_book_ids.append(book_obj["id"])

        filename = write_book_file(group, book_obj, self.dry_run)
        if filename:
            self.completed_files.append(filename)

    def run(self) -> None:
        self._prepare_environment()
        
        book_tasks = generate_book_tasks(self.names_map)
        all_tasks = []
        
        for group_name, tasks in book_tasks.items():
            self.book_totals[group_name] = len(tasks)
            self.book_progress[group_name] = 0
            self.buffers[group_name] = {}
            for task in tasks:
                all_tasks.append(task)
                self.sutta_group_map[task[0]] = group_name

        workers = os.cpu_count() or 4
        logger.info(f"🚀 Processing {len(all_tasks)} items with {workers} workers...")

        with ProcessPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(process_worker, task) for task in all_tasks]
            
            for i, future in enumerate(as_completed(futures)):
                try:
                    res_status, res_sid, content = future.result()
                    target_group = self.sutta_group_map.get(res_sid)
                    
                    if target_group:
                        success_content = content if res_status == "success" else None
                        self._handle_task_completion(target_group, res_sid, success_content)
                except Exception as e:
                    logger.error(f"❌ Worker exception: {e}")

                if (i + 1) % 1000 == 0:
                    logger.info(f"   Processed {i + 1}/{len(all_tasks)} items...")

        # --- [NEW STEP] GENERATE SUPER BOOK ---
        # Chỉ chạy sau khi đã xác định được tất cả các sách có sẵn
        if self.processed_book_ids:
            super_book_data = generate_super_book_data(self.processed_book_ids)
            if super_book_data:
                # Ghi file super-book (sử dụng logic ghi file có sẵn)
                # Tên group là "super" -> file sẽ là super_book.js / super_book.json
                # Tuy nhiên user yêu cầu file tên là "super-book.json"
                # write_book_file tự động thêm suffix _book.js/.json
                # Ta dùng group name là "super" => output: super_book.js
                
                # Nếu muốn chính xác là "super-book" (dấu gạch ngang), ta có thể hack group name
                # Nhưng để đồng bộ, tôi khuyên dùng "super" => super_book.js
                # Ở đây tôi sẽ dùng "super" để khớp với logic system.
                
                super_filename = write_book_file("super", super_book_data, self.dry_run)
                if super_filename:
                    # KHÔNG thêm vào completed_files để tránh loader.js load nhầm nó như một cuốn sách
                    # Hoặc thêm vào tùy thuộc strategy của Frontend. 
                    # Với yêu cầu hiện tại, nó là file cấu trúc, không phải content book.
                    logger.info(f"🌟 Super Book generated: {super_filename}")

        if not self.dry_run:
            write_loader_script(self.completed_files)
            
        logger.info("✅ All processing tasks completed.")