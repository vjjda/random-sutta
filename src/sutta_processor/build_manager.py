# Path: src/sutta_processor/build_manager.py
import logging
import os
import json
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any, Tuple, Optional

from .shared.app_config import (
    STAGE_PROCESSED_DIR, 
    LEGACY_DIST_BOOKS_DIR,
    PROJECT_ROOT,
    RAW_SUPER_TREE_FILE # [NEW]
)
from .ingestion.metadata_parser import load_names_map
from .ingestion.file_crawler import generate_book_tasks
from .ingestion.fix_loader import load_fix_map

# Logic Imports
from .logic.content_merger import process_worker, init_worker
from .logic.structure import build_book_data
from .logic.super_generator import generate_super_book_data
from .logic.universe_builder import UniverseBuilder

# Output Imports
from .output.asset_generator import write_book_file
from .output.zip_generator import create_db_bundle
from .output.report_writer import ReportWriter
from .optimizer import run_optimizer

logger = logging.getLogger("SuttaProcessor.BuildManager")

class BuildManager:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.names_map = load_names_map()
        self.fix_map = load_fix_map()
        self.reporter = ReportWriter(PROJECT_ROOT / "tmp")
        
        self.buffers: Dict[str, Dict[str, Any]] = {}
        self.book_totals: Dict[str, int] = {}
        self.book_progress: Dict[str, int] = {}
        self.processed_book_ids: List[str] = [] 
        self.sutta_group_map: Dict[str, str] = {}
        
        # Accumulators
        self.all_generated_items: List[Tuple[str, str, str, str]] = []
        
        # [NEW] Super Navigation Map (Book level: dn -> next: mn)
        self.super_nav_map: Dict[str, Dict[str, str]] = {}

    def _prepare_environment(self) -> None:
        if STAGE_PROCESSED_DIR.exists():
            shutil.rmtree(STAGE_PROCESSED_DIR)
        STAGE_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        
        if not self.dry_run and LEGACY_DIST_BOOKS_DIR.exists():
             shutil.rmtree(LEGACY_DIST_BOOKS_DIR)
             
        mode = "🧪 DRY-RUN" if self.dry_run else "🚀 PRODUCTION"
        logger.info(f"{mode} MODE INITIALIZED")

    # [NEW] Helper để xây dựng navigation giữa các sách từ Super Tree
    def _build_super_navigation(self, valid_books: List[str]) -> None:
        if not RAW_SUPER_TREE_FILE.exists():
            logger.warning("⚠️ Super Tree file not found. Skipping root navigation.")
            return

        try:
            with open(RAW_SUPER_TREE_FILE, "r", encoding="utf-8") as f:
                tree_data = json.load(f)
            
            # 1. Flatten Tree để lấy thứ tự sách (chỉ lấy các sách có trong valid_books)
            ordered_books = []
            valid_set = set(valid_books)
            
            def _traverse_find_books(node: Any):
                if isinstance(node, dict):
                    for k, v in node.items():
                        # Nếu key là một book ID hợp lệ, ta lấy nó và DỪNG duyệt sâu (coi như leaf ở level này)
                        if k in valid_set:
                            ordered_books.append(k)
                        else:
                            # Nếu là Group (sutta, vinaya...), duyệt tiếp
                            _traverse_find_books(v)
                elif isinstance(node, list):
                    for item in node:
                         _traverse_find_books(item)

            _traverse_find_books(tree_data)
            
            # 2. Build Nav Map (Next/Prev)
            total = len(ordered_books)
            for i, book_id in enumerate(ordered_books):
                nav_entry = {}
                if i > 0:
                    nav_entry["prev"] = ordered_books[i-1]
                if i < total - 1:
                    nav_entry["next"] = ordered_books[i+1]
                
                if nav_entry:
                    self.super_nav_map[book_id] = nav_entry
            
            logger.info(f"   🗺️  Built Super Navigation for {len(self.super_nav_map)} books.")
            
        except Exception as e:
            logger.error(f"❌ Failed to build super navigation: {e}")

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
        
        # [UPDATED] Truyền super_nav_map vào builder
        book_obj = build_book_data(
            group, 
            raw_data, 
            self.names_map, 
            self.all_generated_items,
            external_root_nav=self.super_nav_map # [NEW]
        )
        
        if book_obj and "id" in book_obj:
            self.processed_book_ids.append(book_obj["id"])

        write_book_file(group, book_obj, dry_run=True) 

    def run(self) -> None:
        self._prepare_environment()
        
        # 1. Generate Tasks
        book_tasks = generate_book_tasks(self.names_map)
        all_tasks = []
        
        # Prepare execution map
        # Extract Book IDs từ group name (vd: "sutta/dn" -> "dn")
        active_book_ids = []

        for group, tasks in book_tasks.items():
            self.book_totals[group] = len(tasks)
            self.book_progress[group] = 0
            self.buffers[group] = {}
            
            book_id = group.split("/")[-1]
            active_book_ids.append(book_id)

            for task in tasks:
                all_tasks.append(task)
                self.sutta_group_map[task[0]] = group

        # [NEW] 1.5 Build Super Navigation BEFORE processing
        self._build_super_navigation(active_book_ids)

        # 2. Build Validation Universe
        valid_uids_universe = UniverseBuilder.build(self.names_map, book_tasks)

        # 3. Execute Workers
        workers = os.cpu_count() or 4
        logger.info(f"🚀 Processing {len(all_tasks)} items with {workers} workers...")
        
        all_missing_links = []

        with ProcessPoolExecutor(
            max_workers=workers, 
            initializer=init_worker, 
            initargs=(valid_uids_universe, self.fix_map)
        ) as executor:
            futures = [executor.submit(process_worker, task) for task in all_tasks]
            
            for i, future in enumerate(as_completed(futures)):
                try:
                    res_status, res_sid, content, missing_refs = future.result()
                    
                    if missing_refs:
                        all_missing_links.extend(missing_refs)

                    target_group = self.sutta_group_map.get(res_sid)
                    
                    if target_group:
                        success_content = content if res_status == "success" else None
                    
                    self._handle_task_completion(target_group, res_sid, success_content)
                except Exception as e:
                    logger.error(f"❌ Worker exception: {e}")

                if (i + 1) % 1000 == 0:
                    logger.info(f"   Processed {i + 1}/{len(all_tasks)} items...")

        # 4. Generate Reports
        missing_msg = self.reporter.write_missing_report(all_missing_links)
        generated_msg = self.reporter.write_generated_report(self.all_generated_items)

        # 5. Post-Processing
        if self.processed_book_ids:
            super_book_data = generate_super_book_data(self.processed_book_ids)
            if super_book_data:
                write_book_file("super", super_book_data, dry_run=True)

        logger.info("⚡ Transforming processed data to Optimized DB...")
        run_optimizer(dry_run=self.dry_run)
        
        if not self.dry_run:
            create_db_bundle()
        
        logger.info("✅ All processing tasks completed.")
        
        if generated_msg:
            logger.info(generated_msg)
        if missing_msg:
            logger.warning(missing_msg)