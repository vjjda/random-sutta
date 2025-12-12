# Path: src/sutta_processor/build_manager.py
import logging
import os
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any, Tuple, Optional, Set

from .shared.app_config import (
    STAGE_PROCESSED_DIR, 
    LEGACY_DIST_BOOKS_DIR,
    PROJECT_ROOT 
)
from .ingestion.metadata_parser import load_names_map
from .ingestion.file_crawler import generate_book_tasks
# [UPDATED] Import loader
from .ingestion.fix_loader import load_fix_map
from .logic.content_merger import process_worker, init_worker
from .logic.structure import build_book_data
from .logic.super_generator import generate_super_book_data
from .output.asset_generator import write_book_file
from .optimizer import run_optimizer
from .output.zip_generator import create_db_bundle
from .logic.range_expander import generate_vinaya_variants, expand_range_ids

logger = logging.getLogger("SuttaProcessor.BuildManager")

# MissingItem Type Alias
MissingItem = Tuple[str, str, str, str, str, str, str]

class BuildManager:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.names_map = load_names_map()
        # [NEW] Load Fixes
        self.fix_map = load_fix_map()
        
        self.buffers: Dict[str, Dict[str, Any]] = {}
        self.book_totals: Dict[str, int] = {}
        self.book_progress: Dict[str, int] = {}
        self.completed_files: List[str] = []
        self.processed_book_ids: List[str] = [] 
        self.sutta_group_map: Dict[str, str] = {}
        
        self.all_generated_items: List[Tuple[str, str, str, str]] = []

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
        book_obj = build_book_data(group, raw_data, self.names_map, self.all_generated_items)
        
        if book_obj and "id" in book_obj:
            self.processed_book_ids.append(book_obj["id"])

        write_book_file(group, book_obj, dry_run=True) 

    def _write_missing_report(self, missing_items: List[MissingItem]) -> Optional[str]:
        if not missing_items:
            return None
        
        tmp_dir = PROJECT_ROOT / "tmp"
        tmp_dir.mkdir(exist_ok=True)
        report_path = tmp_dir / "missing_links.tsv"
        
        try:
            with open(report_path, "w", encoding="utf-8") as f:
                f.write("sutta\tsegment\tlink\tmentioned\tanchor_text\tmiss_uid\thash_id\n")
                for item in missing_items:
                    row = f"{item[0]}\t{item[1]}\t{item[2]}\t{item[3]}\t{item[4]}\t{item[5]}\t{item[6]}\n"
                    f.write(row)
            return f"⚠️  Missing Links Report: {report_path} ({len(missing_items)} items)"
        except Exception as e:
            logger.error(f"❌ Failed to write missing report: {e}")
            return None

    def _write_generated_report(self) -> Optional[str]:
        if not self.all_generated_items:
            return None

        tmp_dir = PROJECT_ROOT / "tmp"
        tmp_dir.mkdir(exist_ok=True)
        report_path = tmp_dir / "generated_items.tsv"
        
        try:
            sorted_items = sorted(self.all_generated_items, key=lambda x: x[0])
            with open(report_path, "w", encoding="utf-8") as f:
                f.write("UID\tType\tParent/Target\tExtract/Hash\n")
                for item in sorted_items:
                    f.write(f"{item[0]}\t{item[1]}\t{item[2]}\t{item[3]}\n")
            return f"📋 Generated Items Report: {report_path} ({len(sorted_items)} items)"
        except Exception as e:
            logger.error(f"❌ Failed to write generated report: {e}")
            return None

    def run(self) -> None:
        self._prepare_environment()
        
        # 1. Generate Tasks
        book_tasks = generate_book_tasks(self.names_map)
        all_tasks = []
        
        task_based_uids: Set[str] = set()
        active_roots: Set[str] = set()

        for group, tasks in book_tasks.items():
            self.book_totals[group] = len(tasks)
            self.book_progress[group] = 0
            self.buffers[group] = {}
            
            root_id = group.split('/')[-1]
            active_roots.add(root_id)

            for task in tasks:
                task_based_uids.add(task[0])
                all_tasks.append(task)
                self.sutta_group_map[task[0]] = group

        logger.info(f"   🔍 Active Roots: {', '.join(sorted(active_roots))}")

        expanded_universe = set(task_based_uids)
        
        logger.info("   🔮 Expanding Validation Universe (Branches & Aliases)...")
        
        count_branches = 0
        for uid in self.names_map:
            if uid in expanded_universe:
                continue
            for root in active_roots:
                if uid.startswith(root):
                    expanded_universe.add(uid)
                    count_branches += 1
                    break
        
        logger.info(f"      -> Added {count_branches} branch/structural UIDs from Metadata.")

        current_uids = list(expanded_universe)
        for uid in current_uids:
            variants = generate_vinaya_variants(uid)
            if variants:
                expanded_universe.update(variants)
            
            range_ids = expand_range_ids(uid)
            if range_ids:
                expanded_universe.update(range_ids)
        
        valid_uids_universe = frozenset(expanded_universe)
        logger.info(f"✨ Validation Universe prepared: {len(valid_uids_universe)} valid targets.")

        # 2. Execute Workers
        workers = os.cpu_count() or 4
        logger.info(f"🚀 Processing {len(all_tasks)} items with {workers} workers...")
        
        all_missing_links = []

        with ProcessPoolExecutor(
            max_workers=workers, 
            initializer=init_worker, 
            # [UPDATED] Truyền thêm self.fix_map
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

        missing_msg = self._write_missing_report(all_missing_links)
        generated_msg = self._write_generated_report()

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