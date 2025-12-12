# Path: src/sutta_processor/build_manager.py
import logging
import os
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any

from .shared.app_config import (
    STAGE_PROCESSED_DIR, 
    LEGACY_DIST_BOOKS_DIR, 
)
from .ingestion.metadata_parser import load_names_map
from .ingestion.file_crawler import generate_book_tasks
from .logic.content_merger import process_worker
from .logic.structure import build_book_data
from .logic.super_generator import generate_super_book_data
from .output.asset_generator import write_book_file
from .optimizer import run_optimizer
from .output.zip_generator import create_db_bundle

# [NEW] Import logic sinh biến thể
from .logic.range_expander import generate_vinaya_variants

logger = logging.getLogger("SuttaProcessor.BuildManager")

class BuildManager:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.names_map = load_names_map()
        
        self.buffers: Dict[str, Dict[str, Any]] = {}
        self.book_totals: Dict[str, int] = {}
        self.book_progress: Dict[str, int] = {}
        self.completed_files: List[str] = []
        self.processed_book_ids: List[str] = [] 
        self.sutta_group_map: Dict[str, str] = {}

    def _prepare_environment(self) -> None:
        if STAGE_PROCESSED_DIR.exists():
            shutil.rmtree(STAGE_PROCESSED_DIR)
        STAGE_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        
        if not self.dry_run and LEGACY_DIST_BOOKS_DIR.exists():
             shutil.rmtree(LEGACY_DIST_BOOKS_DIR)
             
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
        book_obj = build_book_data(group, raw_data, self.names_map)
        
        if book_obj and "id" in book_obj:
            self.processed_book_ids.append(book_obj["id"])

        write_book_file(group, book_obj, dry_run=True) 

    def run(self) -> None:
        self._prepare_environment()
        
        # 1. Generate Tasks
        book_tasks = generate_book_tasks(self.names_map)
        all_tasks = []
        
        # [UPDATED] Chuẩn bị danh sách UID hợp lệ (Universe)
        # Bắt đầu với danh sách gốc từ API Metadata
        base_uids = set(self.names_map.keys())
        expanded_universe = set(base_uids)
        
        logger.info("   🔮 Expanding Validation Universe (Aliases)...")
        # Sinh thêm các biến thể Alias (cho Vinaya) để tránh báo lỗi giả
        for uid in base_uids:
            variants = generate_vinaya_variants(uid)
            if variants:
                expanded_universe.update(variants)
        
        # Đóng băng để tối ưu bộ nhớ khi truyền qua process
        valid_uids_universe = frozenset(expanded_universe)
        logger.info(f"✨ Validation Universe prepared: {len(valid_uids_universe)} valid targets (Base: {len(base_uids)}).")

        for group_name, tasks in book_tasks.items():
            self.book_totals[group_name] = len(tasks)
            self.book_progress[group_name] = 0
            self.buffers[group_name] = {}
            for task in tasks:
                # Inject valid_uids_universe vào cuối
                expanded_task = task + (valid_uids_universe,)
                all_tasks.append(expanded_task)
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

        # 3. Generate Super Book
        if self.processed_book_ids:
            super_book_data = generate_super_book_data(self.processed_book_ids)
            if super_book_data:
                write_book_file("super", super_book_data, dry_run=True)

        # 4. Optimizer
        logger.info("⚡ Transforming processed data to Optimized DB...")
        run_optimizer(dry_run=self.dry_run)
        
        # 5. Zip Bundle
        if not self.dry_run:
            create_db_bundle()
        logger.info("✅ All processing tasks completed.")