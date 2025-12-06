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
from .logic.super_generator import generate_super_book_data
from .output.asset_generator import write_book_file
from .logic.rearchitect_db import run_optimizer # [NEW]


logger = logging.getLogger("SuttaProcessor.BuildManager")

class BuildManager:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.names_map = load_names_map()
        
        self.buffers: Dict[str, Dict[str, Any]] = {}
        self.book_totals: Dict[str, int] = {}
        self.book_progress: Dict[str, int] = {}
        self.completed_files: List[str] = []
        
        # Theo dõi ID các sách đã build để truyền cho SuperGen
        self.processed_book_ids: List[str] = [] 
        
        self.sutta_group_map: Dict[str, str] = {}

    def _prepare_environment(self) -> None:
        """
        Chuẩn bị thư mục output.
        - Luôn reset thư mục JSON (PROCESSED_DIR).
        - Nếu Production: Reset thêm thư mục JS (OUTPUT_DB_DIR).
        """
        # 1. Always prepare JSON dir (Dry-run data)
        if PROCESSED_DIR.exists():
            shutil.rmtree(PROCESSED_DIR)
        PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        
        # 2. If Production, prepare JS dir
        if not self.dry_run:
            if OUTPUT_DB_DIR.exists():
                shutil.rmtree(OUTPUT_DB_DIR)
            OUTPUT_DB_DIR.mkdir(parents=True, exist_ok=True)
            mode = "🚀 PRODUCTION (Dual Output: JSON + JS)"
        else:
            mode = "🧪 DRY-RUN (JSON Only)"
            
        logger.info(f"{mode} MODE INITIALIZED")

    def _handle_task_completion(self, group: str, sutta_id: str, content: Any) -> None:
        """Xử lý kết quả trả về từ worker."""
        if content:
            self.buffers[group][sutta_id] = content
        
        self.book_progress[group] += 1
        
        # Nếu đã xử lý xong toàn bộ sách trong nhóm -> Ghi file
        if self.book_progress[group] >= self.book_totals[group]:
            self._finalize_book(group)
            if group in self.buffers:
                del self.buffers[group]

    def _finalize_book(self, group: str) -> None:
        """Tổng hợp dữ liệu và ghi file sách."""
        raw_data = self.buffers.get(group, {})
        book_obj = build_book_data(group, raw_data, self.names_map)
        
        # Lưu lại ID sách (ví dụ: 'dn', 'mn', 'pli-tv-bi-pm') để dùng cho Super Book
        if book_obj and "id" in book_obj:
            self.processed_book_ids.append(book_obj["id"])

        # Hàm này giờ sẽ tự xử lý việc ghi cả JSON và JS (nếu ko phải dry-run)
        filename = write_book_file(group, book_obj, self.dry_run)
        
        # Chỉ thêm vào danh sách completed nếu có file JS (tức là return filename hợp lệ)
        if filename and not self.dry_run:
            self.completed_files.append(filename)

    def run(self) -> None:
        self._prepare_environment()
        
        # 1. Generate Tasks
        book_tasks = generate_book_tasks(self.names_map)
        all_tasks = []
        
        for group_name, tasks in book_tasks.items():
            self.book_totals[group_name] = len(tasks)
            self.book_progress[group_name] = 0
            self.buffers[group_name] = {}
            for task in tasks:
                all_tasks.append(task)
                self.sutta_group_map[task[0]] = group_name

        # 2. Execute Workers
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

        # 3. Generate Super Book (Menu Structure)
        if self.processed_book_ids:
            super_book_data = generate_super_book_data(self.processed_book_ids)
            if super_book_data:
                # Ghi file super_book JSON (để rearchitect dùng)
                # Lưu ý: write_book_file bây giờ chỉ cần ghi JSON vào processed là đủ
                # Không cần nó ghi JS ra assets/books cũ nữa (trừ khi dry_run)
                write_book_file("super", super_book_data, self.dry_run) 

        # [NEW PHASE] 4. Run Optimizer (Re-architect DB)
        if not self.dry_run:
            logger.info("⚡ Transforming processed data to Optimized DB...")
            run_optimizer()
            
            # [NOTE] Không cần gọi write_loader_script cũ nữa 
            # vì loader mới sẽ đọc uid_index.json
            
        logger.info("✅ All processing tasks completed.")