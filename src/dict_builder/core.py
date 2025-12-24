# Path: src/dict_builder/core.py
import sqlite3
import time
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import List, Tuple
from rich import print

from src.db.db_helpers import get_db_session
from src.db.models import DpdHeadword, Lookup
from src.tools.paths import ProjectPaths
from src.tools.text_scanner import get_ebts_word_set
from src.tools.deconstructed_words import make_words_in_deconstructions
from src.tools.pali_sort_key import pali_sort_key

from .config import BuilderConfig
from .renderer import DpdRenderer

# --- WORKER FUNCTION (Must be top-level for pickling) ---
def process_batch(ids: List[int], config: BuilderConfig) -> Tuple[List, List]:
    """
    Hàm này chạy trong một Process riêng biệt.
    Nó tự tạo connection DB riêng để tránh lỗi thread-safety của SQLAlchemy.
    """
    # Khởi tạo renderer và db session cục bộ cho process này
    renderer = DpdRenderer(config)
    session = get_db_session(config.DPD_DB_PATH)
    
    entries_data = []
    lookups_data = []
    
    try:
        # Query một lần lấy hết các items trong batch để tối ưu
        headwords = session.query(DpdHeadword).filter(DpdHeadword.id.in_(ids)).all()
        
        # Sort lại theo thứ tự ID đầu vào (nếu cần, hoặc sort sau)
        # Ở đây ta không quan trọng thứ tự xử lý, chỉ quan trọng kết quả
        
        for i in headwords:
            # 1. Render HTML
            grammar = renderer.render_grammar(i)
            examples = renderer.render_examples(i)
            # [UPDATED] Không truyền grammar/example vào render_entry nữa
            definition = renderer.render_entry(i)
            data_json = renderer.extract_json_data(i)
            
            # 2. Prepare Data Tuple
            entries_data.append((
                i.id,
                i.lemma_1,
                i.lemma_clean,
                definition,
                grammar,
                examples,
                data_json
            ))
            
            # 3. Lookups
            lookups_data.append((i.lemma_clean, i.id, 'entry', 0))
            for inf in i.inflections_list_all:
                if inf:
                    lookups_data.append((inf, i.id, 'entry', 1))
                    
    except Exception as e:
        print(f"[red]Error in worker process: {e}")
    finally:
        session.close()
        
    return entries_data, lookups_data

# --- MAIN CLASS ---
class DictBuilder:
    def __init__(self, mode: str = "mini"):
        self.config = BuilderConfig(mode=mode)
        self.pth = ProjectPaths()
        # Renderer ở đây chỉ dùng cho các tác vụ đơn lẻ (deconstructions)
        self.renderer = DpdRenderer(self.config)
        
    def _init_db(self):
        """Khởi tạo file SQLite và nạp Schema."""
        if not self.config.OUTPUT_DIR.exists():
            self.config.OUTPUT_DIR.mkdir(parents=True)
            
        if self.config.output_path.exists():
            self.config.output_path.unlink()
            
        self.conn = sqlite3.connect(self.config.output_path)
        self.cursor = self.conn.cursor()
        
        # Tắt journal mode hoặc dùng WAL để insert nhanh hơn
        self.cursor.execute("PRAGMA synchronous = OFF")
        self.cursor.execute("PRAGMA journal_mode = MEMORY")
        
        schema_path = self.config.TEMPLATES_DIR.parent / "schema.sql"
        with open(schema_path, "r", encoding="utf-8") as f:
            self.cursor.executescript(f.read())
            
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", 
                            ("version", datetime.now().strftime("%Y-%m-%d")))
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", 
                            ("mode", self.config.mode))
        self.conn.commit()

    def _get_target_ids(self, session) -> List[int]:
        """Lấy danh sách ID cần xử lý (nhanh hơn lấy full object)."""
        print(f"[green]Scanning DPD DB (Mode: {self.config.mode})...")
        
        # Lấy tất cả (ID, Lemma, Inflections) để lọc nhanh
        # Chỉ lấy cột cần thiết để tiết kiệm RAM
        query = session.query(DpdHeadword.id, DpdHeadword.lemma_1, DpdHeadword.inflections, DpdHeadword.inflections_api_ca_eva_iti)
        
        if self.config.is_full_mode:
            print("[green]Full Mode: Selecting all IDs.")
            return [row.id for row in query.all()]

        # --- MINI MODE ---
        print("[yellow]Calculating EBTS word set...")
        bilara_path = self.config.PROJECT_ROOT / "data/bilara/root/pli/ms"
        if not bilara_path.exists():
            print(f"[red]Bilara data missing at {bilara_path}")
            return []

        target_set = get_ebts_word_set(bilara_path, self.config.EBTS_BOOKS)
        decon_set = make_words_in_deconstructions(session)
        target_set = target_set | decon_set
        
        print(f"[green]Target words: {len(target_set)}")
        
        target_ids = []
        for row in query.all():
            # Tái tạo logic lemma_clean
            lemma_clean = row.lemma_1.split(" ")[0] # basic clean
            
            # Logic check nhanh
            if lemma_clean in target_set:
                target_ids.append(row.id)
                continue
            
            # Check inflections
            infs = []
            if row.inflections: infs.extend(row.inflections.split(","))
            if row.inflections_api_ca_eva_iti: infs.extend(row.inflections_api_ca_eva_iti.split(","))
            
            if not set(infs).isdisjoint(target_set):
                target_ids.append(row.id)
                
        print(f"[green]Filtered down to {len(target_ids)} entries.")
        return target_ids

    def run(self):
        start_time = time.time()
        print(f"🚀 Starting Multi-process Dictionary Builder...")
        self._init_db()
        
        session = get_db_session(self.config.DPD_DB_PATH)
        
        # 1. Lấy danh sách ID cần xử lý
        target_ids = self._get_target_ids(session)
        if not target_ids:
            return

        # 2. Chia nhỏ thành batches (Chunks)
        BATCH_SIZE = 1000
        chunks = [target_ids[i:i + BATCH_SIZE] for i in range(0, len(target_ids), BATCH_SIZE)]
        print(f"[green]Processing {len(target_ids)} items in {len(chunks)} chunks...")

        # 3. Chạy Multi-processing
        # Sử dụng số core CPU tối đa
        processed_count = 0
        
        with ProcessPoolExecutor() as executor:
            # Submit tất cả tasks
            futures = [executor.submit(process_batch, chunk, self.config) for chunk in chunks]
            
            for future in as_completed(futures):
                entries, lookups = future.result()
                
                # Ghi vào DB ngay khi có kết quả
                if entries:
                    self.cursor.executemany(
                        "INSERT INTO entries (id, headword, headword_clean, definition_html, grammar_html, example_html, data_json) VALUES (?,?,?,?,?,?,?)",
                        entries
                    )
                if lookups:
                    self.cursor.executemany(
                        "INSERT INTO lookups (key, target_id, target_type, is_inflection) VALUES (?,?,?,?)",
                        lookups
                    )
                
                processed_count += len(entries)
                print(f"   Saved batch... ({processed_count}/{len(target_ids)})", end="\r")
        
        print(f"\n[green]Headwords processing finished in {time.time() - start_time:.2f}s")

        # 4. Xử lý Deconstructions (Nhanh nên chạy đơn luồng cũng được)
        print("[green]Processing Deconstructions...")
        deconstructions = session.query(Lookup).filter(Lookup.deconstructor != "").all()
        
        decon_batch = []
        decon_lookup_batch = []
        
        for idx, d in enumerate(deconstructions, start=1):
            html = self.renderer.render_deconstruction(d)
            split_str = " + ".join(d.deconstructor_unpack_list)
            
            decon_batch.append((idx, d.lookup_key, split_str, html))
            decon_lookup_batch.append((d.lookup_key, idx, 'deconstruction', 0))
            
        self.cursor.executemany(
            "INSERT INTO deconstructions (id, lookup_key, split_string, html) VALUES (?,?,?,?)",
            decon_batch
        )
        self.cursor.executemany(
            "INSERT INTO lookups (key, target_id, target_type, is_inflection) VALUES (?,?,?,?)",
            decon_lookup_batch
        )
        
        self.conn.commit()
        
        print("[green]Indexing & Optimizing (VACUUM)...")
        self.conn.execute("VACUUM")
        
        self.conn.close()
        session.close()
        
        print(f"✅ Build Complete: {self.config.output_path}")
        print(f"⏱️ Total Time: {time.time() - start_time:.2f}s")

def run_builder():
    # Cần bảo vệ entry point khi dùng multiprocessing trên một số OS
    builder = DictBuilder(mode="mini")
    builder.run()