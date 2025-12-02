# Path: src/sutta_processor/orchestrator.py
import logging
import os
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any

# --- CÁC IMPORT MỚI (ĐÃ SỬA) ---
from .shared.app_config import OUTPUT_SUTTA_BOOKS, PROCESSED_DIR
from .ingestion.metadata_parser import load_names_map
from .ingestion.file_crawler import generate_book_tasks
from .logic.content_merger import process_worker
from .logic.structure_handler import build_book_data
from .output.asset_generator import write_book_file, write_loader_script

logger = logging.getLogger("SuttaProcessor.Orchestrator")

class SuttaOrchestrator:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.names_map = load_names_map()
        
        self.buffers: Dict[str, Dict[str, Any]] = {}
        self.book_totals: Dict[str, int] = {}
        self.book_progress: Dict[str, int] = {}
        self.completed_files: List[str] = []
        self.sutta_group_map: Dict[str, str] = {}

    def _prepare_environment(self) -> None:
        target_dir = PROCESSED_DIR if self.dry_run else OUTPUT_SUTTA_BOOKS
        if target_dir.exists():
            shutil.rmtree(target_dir)
        target_dir.mkdir(parents=True, exist_ok=True)
        
        mode = "🧪 DRY-RUN" if self.dry_run else "🚀 PRODUCTION"
        logger.info(f"{mode} MODE INITIALIZED")

    def _handle_task_completion(self, group: str, sutta_id: str, content: Any) -> None:
        if content:
            self.buffers[group][sutta_id] = content
        
        self.book_progress[group] += 1
        
        if self.book_progress[group] >= self.book_totals[group]:
            self._finalize_book(group)
            if group in self.buffers:
                del self.buffers[group]

    def _finalize_book(self, group: str) -> None:
        raw_data = self.buffers.get(group, {})
        # Gọi Logic Layer
        book_obj = build_book_data(group, raw_data, self.names_map)
        # Gọi Output Layer
        filename = write_book_file(group, book_obj, self.dry_run)
        if filename:
            self.completed_files.append(filename)

    def run(self) -> None:
        self._prepare_environment()
        
        # Gọi Ingestion Layer
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
            # Logic Layer Worker
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

        if not self.dry_run:
            write_loader_script(self.completed_files)
            
        logger.info("✅ All processing tasks completed.")