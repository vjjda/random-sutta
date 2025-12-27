# Path: src/dict_builder/dict_builder_app.py
import time
import logging

from src.dict_builder.db.db_helpers import get_db_session
from src.dict_builder.db.models import Lookup, DpdRoot
from src.dict_builder.tools.pali_sort_key import pali_sort_key

from .builder_config import BuilderConfig
# [FIXED] Import từ package 'database' thay vì module 'output_database' cũ
from .logic.database import OutputDatabase
from .logic.word_selector import WordSelector
from .logic.parallel_processor import ParallelProcessor
from .tools.db_packager import DbPackager 

# Import workers and wrappers
from .logic.batch_worker import (
    process_batch_worker, 
    process_grammar_notes_worker, 
    decon_worker_wrapper, 
    roots_worker_wrapper
)

logger = logging.getLogger("dict_builder")

class DictBuilder:
    """
    Orchestrator Class: Chỉ điều phối luồng xử lý, không chứa logic chi tiết.
    """
    def __init__(self, mode: str = "mini", html_mode: bool = False, export_web: bool = False):
        self.config = BuilderConfig(mode=mode, html_mode=html_mode, export_web=export_web)
        self.processor = ParallelProcessor()
        self.output_db = None
        self.session = None

    def run(self):
        start_time = time.time()
        fmt = "HTML" if self.config.html_mode else "JSON"
        target_str = "WEB" if self.config.export_web else "LOCAL"
        logger.info(f"🚀 Starting Dictionary Builder (Mode: {self.config.mode}, Format: {fmt}, Target: {target_str})...")
        
        try:
            self.output_db = OutputDatabase(self.config)
            self.output_db.setup()

            self.session = get_db_session(self.config.DPD_DB_PATH)
            selector = WordSelector(self.config)
            
            # --- PHASE 0: PREPARE TARGETS ---
            target_ids, target_set = selector.get_target_ids(self.session)
            
            if not target_ids:
                logger.error("[red]No targets found. Aborting.")
                return

            # --- PHASE 1: HEADWORDS ---
            def headword_handler(result):
                entries, lookups = result
                self.output_db.insert_batch(entries, lookups)
                return len(entries)

            BATCH_SIZE = self.config.BATCH_SIZE_HEADWORDS
            chunks = [target_ids[i:i + BATCH_SIZE] for i in range(0, len(target_ids), BATCH_SIZE)]
            
            self.processor.run_safe(
                worker_func=process_batch_worker, 
                chunks=chunks, 
                label="headwords", 
                total_items=len(target_ids), 
                result_handler=headword_handler, 
                config=self.config, 
                target_set=target_set 
            )
            
            logger.info(f"\n[green]Headwords processing finished in {time.time() - start_time:.2f}s")

            # --- PHASE 2: DECONSTRUCTIONS ---
            logger.info("[green]Processing Deconstructions (Parallel)...")
            decon_keys = [r.lookup_key for r in self.session.query(Lookup.lookup_key).filter(Lookup.deconstructor != "").all()]
            
            if target_set is not None:
                original_count = len(decon_keys)
                decon_keys = [k for k in decon_keys if k in target_set]
                logger.info(f"[cyan]Filtered deconstructions: {original_count} -> {len(decon_keys)}")

            logger.info("[yellow]Sorting Deconstruction keys (Pali Order)...[/yellow]")
            decon_keys.sort(key=pali_sort_key)

            DECON_BATCH_SIZE = self.config.BATCH_SIZE_DECON
            decon_chunks = []
            for i in range(0, len(decon_keys), DECON_BATCH_SIZE):
                chunk_keys = decon_keys[i : i + DECON_BATCH_SIZE]
                start_id = i + 1 
                decon_chunks.append((chunk_keys, start_id))
            
            def decon_handler(result):
                decons, lookups = result
                self.output_db.insert_deconstructions(decons, lookups)
                return len(decons)

            self.processor.run_safe(
                worker_func=decon_worker_wrapper,
                chunks=decon_chunks, 
                label="deconstructions",
                total_items=len(decon_keys),
                result_handler=decon_handler,
                config=self.config 
            )

            # --- PHASE 3: GRAMMAR NOTES ---
            logger.info("\n[green]Processing Grammar Notes (Parallel)...")
            grammar_keys = [r.lookup_key for r in self.session.query(Lookup.lookup_key).filter(Lookup.grammar != "").all()]
            
            if target_set is not None:
                original_grammar_count = len(grammar_keys)
                grammar_keys = [k for k in grammar_keys if k in target_set]
                logger.info(f"[cyan]Filtered grammar notes: {original_grammar_count} -> {len(grammar_keys)}")

            logger.info("[yellow]Sorting Grammar Note keys (Pali Order)...[/yellow]")
            grammar_keys.sort(key=pali_sort_key)

            GRAMMAR_BATCH_SIZE = self.config.BATCH_SIZE_GRAMMAR
            grammar_chunks = [grammar_keys[i : i + GRAMMAR_BATCH_SIZE] for i in range(0, len(grammar_keys), GRAMMAR_BATCH_SIZE)]
            
            def grammar_handler(result):
                grammar_batch = result
                self.output_db.insert_grammar_notes(grammar_batch)
                return len(grammar_batch)
                
            self.processor.run_safe(
                worker_func=process_grammar_notes_worker,
                chunks=grammar_chunks,
                label="grammar notes",
                total_items=len(grammar_keys),
                result_handler=grammar_handler,
                config=self.config
            )

            # --- PHASE 4: ROOTS ---
            logger.info("\n[green]Processing Roots (Parallel)...")
            root_keys = [r.root for r in self.session.query(DpdRoot.root).all()]
            
            logger.info("[yellow]Sorting Root keys (Pali Order)...[/yellow]")
            root_keys.sort(key=pali_sort_key)
            
            ROOTS_START_ID = self.config.ROOTS_START_ID
            ROOTS_BATCH_SIZE = self.config.ROOTS_BATCH_SIZE
            
            root_chunks = []
            for i in range(0, len(root_keys), ROOTS_BATCH_SIZE):
                chunk_keys = root_keys[i : i + ROOTS_BATCH_SIZE]
                chunk_start_id = ROOTS_START_ID + i 
                root_chunks.append((chunk_keys, chunk_start_id))
                
            def roots_handler(result):
                roots_data, lookups = result
                self.output_db.insert_roots(roots_data, lookups)
                return len(roots_data)
                
            self.processor.run_safe(
                worker_func=roots_worker_wrapper,
                chunks=root_chunks,
                label="roots",
                total_items=len(root_keys),
                result_handler=roots_handler,
                config=self.config
            )

            # --- PHASE 5: CLEANUP & FINAL SORT ---
            self.output_db.close() 
            
            # --- PHASE 6: PACKAGING ---
            if self.config.export_web:
                logger.info("\n[green]Packaging Database for Web...[/green]")
                if DbPackager.pack_database(self.config.output_path, self.config.WEB_OUTPUT_DIR):
                    logger.info(f"[green]✅ Web Artifacts created at: {self.config.WEB_OUTPUT_DIR}")
            else:
                logger.info(f"\n[dim]Skipping web packaging (Use -e to export). Raw file at: {self.config.output_path}[/dim]")
            
            logger.info(f"\n✅ Build Complete: {self.config.output_path}")
            logger.info(f"⏱️ Total Time: {time.time() - start_time:.2f}s")
            
        except KeyboardInterrupt:
            logger.warning("\n[bold yellow]⚠️ User interrupted![/bold yellow]")
        except Exception as e:
            logger.error(f"[bold red]❌ Unexpected Error: {e}[/bold red]", exc_info=True)
        finally:
            if self.session:
                self.session.close()

def run_builder(mode: str = "mini", html_mode: bool = False, export_web: bool = False):
    builder = DictBuilder(mode=mode, html_mode=html_mode, export_web=export_web)
    builder.run()
    return builder

def run_builder_with_export(mode: str = "mini", html_mode: bool = False, export_flag: bool = False):
    run_builder(mode=mode, html_mode=html_mode, export_web=export_flag)