# Path: src/dict_builder/dict_builder_app.py
import time
import logging
from concurrent.futures import ProcessPoolExecutor, as_completed, CancelledError

from src.dict_builder.db.db_helpers import get_db_session
from src.dict_builder.db.models import Lookup

from .builder_config import BuilderConfig
from .entry_renderer import DpdRenderer

from .logic.output_database import OutputDatabase
from .logic.word_selector import WordSelector
from .logic.batch_worker import process_batch_worker, process_decon_worker, process_grammar_notes_worker

logger = logging.getLogger("dict_builder")

class DictBuilder:
    def __init__(self, mode: str = "mini", html_mode: bool = False):
        self.config = BuilderConfig(mode=mode, html_mode=html_mode)
        self.executor = None
        self.output_db = None
        self.session = None

    def run_safe_executor(self, worker_func, chunks, label, total_items, result_handler, *args):
        """
        Generic helper to run tasks in parallel with safe KeyboardInterrupt handling.
        Ensures strict insertion order by consuming results sequentially.
        """
        if not chunks:
            return

        logger.info(f"[green]Processing {total_items} {label} in {len(chunks)} chunks...")
        processed_count = 0
        
        try:
            with ProcessPoolExecutor() as executor:
                self.executor = executor
                # Submit all tasks
                futures = [executor.submit(worker_func, chunk, *args) for chunk in chunks]
                
                # Consume results strictly in order of submission
                for future in futures:
                    try:
                        result = future.result()
                        processed_count += result_handler(result)
                        logger.info(f"   Saved {label}... ({processed_count}/{total_items})")
                    except Exception as e:
                        logger.error(f"[red]{label} batch error: {e}")
        except KeyboardInterrupt:
            logger.warning("\n[bold yellow]⚠️ User interrupted! Shutting down workers...[/bold yellow]")
            if self.executor:
                self.executor.shutdown(wait=False, cancel_futures=True)
            raise

    def run(self):
        start_time = time.time()
        fmt = "HTML" if self.config.html_mode else "JSON"
        logger.info(f"🚀 Starting Dictionary Builder (Mode: {self.config.mode}, Format: {fmt})...")
        
        try:
            self.output_db = OutputDatabase(self.config)
            self.output_db.setup()

            self.session = get_db_session(self.config.DPD_DB_PATH)
            selector = WordSelector(self.config)
            
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
            
            self.run_safe_executor(
                process_batch_worker, 
                chunks, 
                "headwords", 
                len(target_ids), 
                headword_handler, 
                self.config, 
                target_set
            )
            
            logger.info(f"\n[green]Headwords processing finished in {time.time() - start_time:.2f}s")

            # --- PHASE 2: DECONSTRUCTIONS ---
            logger.info("[green]Processing Deconstructions (Parallel)...")
            decon_keys = [r.lookup_key for r in self.session.query(Lookup.lookup_key).filter(Lookup.deconstructor != "").all()]
            
            if target_set is not None:
                original_count = len(decon_keys)
                decon_keys = [k for k in decon_keys if k in target_set]
                logger.info(f"[cyan]Filtered deconstructions: {original_count} -> {len(decon_keys)}")

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

            self.run_safe_executor(
                decon_worker_wrapper,
                decon_chunks, 
                "deconstructions",
                len(decon_keys),
                decon_handler,
                self.config 
            )

            # --- PHASE 3: GRAMMAR NOTES ---
            logger.info("\n[green]Processing Grammar Notes (Parallel)...")
            grammar_keys = [r.lookup_key for r in self.session.query(Lookup.lookup_key).filter(Lookup.grammar != "").all()]
            
            if target_set is not None:
                original_grammar_count = len(grammar_keys)
                grammar_keys = [k for k in grammar_keys if k in target_set]
                logger.info(f"[cyan]Filtered grammar notes: {original_grammar_count} -> {len(grammar_keys)}")

            GRAMMAR_BATCH_SIZE = self.config.BATCH_SIZE_GRAMMAR
            grammar_chunks = [grammar_keys[i : i + GRAMMAR_BATCH_SIZE] for i in range(0, len(grammar_keys), GRAMMAR_BATCH_SIZE)]
            
            def grammar_handler(result):
                grammar_batch = result
                self.output_db.insert_grammar_notes(grammar_batch)
                return len(grammar_batch)
                
            self.run_safe_executor(
                process_grammar_notes_worker,
                grammar_chunks,
                "grammar notes",
                len(grammar_keys),
                grammar_handler,
                self.config
            )

            # --- PHASE 4: CLEANUP ---
            self.output_db.close()
            logger.info(f"\n✅ Build Complete: {self.config.output_path}")
            logger.info(f"⏱️ Total Time: {time.time() - start_time:.2f}s")
            
        except KeyboardInterrupt:
            logger.warning("\n[bold yellow]⚠️ User interrupted! Shutting down workers...[/bold yellow]")
        except Exception as e:
            logger.error(f"[bold red]❌ Unexpected Error: {e}[/bold red]", exc_info=True)
        finally:
            if self.session:
                self.session.close()

def run_builder(mode: str = "mini", html_mode: bool = False):
    builder = DictBuilder(mode=mode, html_mode=html_mode)
    builder.run()

# Helper for unpacking tuple arguments for deconstructions
def decon_worker_wrapper(args_tuple, config):
    keys, start_id = args_tuple
    return process_decon_worker(keys, start_id, config)
