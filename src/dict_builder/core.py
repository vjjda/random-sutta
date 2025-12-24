# Path: src/dict_builder/core.py
import sqlite3
import shutil
from datetime import datetime
from rich import print

from src.db.db_helpers import get_db_session
from src.db.models import DpdHeadword, Lookup
from src.tools.paths import ProjectPaths
from src.tools.text_scanner import get_ebts_word_set
from src.tools.deconstructed_words import make_words_in_deconstructions
from src.tools.pali_sort_key import pali_sort_key

from .config import BuilderConfig
from .renderer import DpdRenderer

class DictBuilder:
    def __init__(self, mode: str = "mini"):
        """
        Khởi tạo DictBuilder.
        :param mode: 'mini' (chỉ EBTS) hoặc 'full' (toàn bộ từ điển).
        """
        self.config = BuilderConfig(mode=mode)
        self.pth = ProjectPaths()
        self.renderer = DpdRenderer(self.config)
        
    def _init_db(self):
        """Khởi tạo file SQLite và nạp Schema."""
        if not self.config.OUTPUT_DIR.exists():
            self.config.OUTPUT_DIR.mkdir(parents=True)
            
        if self.config.output_path.exists():
            self.config.output_path.unlink()
            
        self.conn = sqlite3.connect(self.config.output_path)
        self.cursor = self.conn.cursor()
        
        schema_path = self.config.TEMPLATES_DIR.parent / "schema.sql"
        with open(schema_path, "r", encoding="utf-8") as f:
            self.cursor.executescript(f.read())
            
        self.cursor.execute(
            "INSERT INTO metadata (key, value) VALUES (?, ?)", 
            ("version", datetime.now().strftime("%Y-%m-%d"))
        )
        self.cursor.execute(
            "INSERT INTO metadata (key, value) VALUES (?, ?)", 
            ("mode", self.config.mode)
        )
        self.conn.commit()

    def _get_target_headwords(self, session) -> list[DpdHeadword]:
        """Lọc danh sách từ cần build dựa trên chế độ (Mini/Full)."""
        print(f"[green]Querying DPD DB (Mode: {self.config.mode})...")
        all_headwords = session.query(DpdHeadword).all()
        
        if self.config.is_full_mode:
            print(f"[green]Full Mode: Selected all {len(all_headwords)} headwords.")
            return all_headwords

        # --- MINI MODE LOGIC ---
        print("[yellow]Calculating EBTS word set from Bilara Data...")
        
        bilara_path = self.config.PROJECT_ROOT / "data/bilara/root/pli/ms"
        
        if not bilara_path.exists():
            print(f"[red]Error: Bilara data not found at {bilara_path}")
            print("[red]Please run 'make sync-text' first!")
            return []

        target_set = get_ebts_word_set(bilara_path, self.config.EBTS_BOOKS)
        
        print("[yellow]Adding words from deconstructions...")
        decon_set = make_words_in_deconstructions(session)
        
        target_set = target_set | decon_set
        print(f"[green]Total unique words in target set: {len(target_set)}")

        filtered = []
        print("[yellow]Filtering headwords...")
        for i in all_headwords:
            if i.lemma_clean in target_set:
                filtered.append(i)
                continue
            
            if not set(i.inflections_list_all).isdisjoint(target_set):
                filtered.append(i)

        print(f"[green]Mini Mode: Filtered down to {len(filtered)} headwords.")
        return filtered

    def run(self):
        print(f"🚀 Starting Dictionary Builder...")
        self._init_db()
        
        session = get_db_session(self.config.DPD_DB_PATH)
        
        headwords = self._get_target_headwords(session)
        if not headwords:
            print("[red]No headwords found. Aborting.")
            return

        print("[yellow]Sorting headwords...")
        headwords = sorted(headwords, key=lambda x: pali_sort_key(x.lemma_1))
        
        print(f"[green]Processing entries and generating HTML...")
        
        entries_batch = []
        lookups_batch = []
        
        count = 0
        total = len(headwords)
        
        for i in headwords:
            grammar = self.renderer.render_grammar(i)
            examples = self.renderer.render_examples(i)
            definition = self.renderer.render_entry(i, grammar, examples)
            data_json = self.renderer.extract_json_data(i)
            
            entries_batch.append((
                i.id,
                i.lemma_1,
                i.lemma_clean,
                definition,
                grammar,
                examples,
                data_json
            ))
            
            lookups_batch.append((i.lemma_clean, i.id, 'entry', 0))
            
            for inf in i.inflections_list_all:
                if inf: 
                    lookups_batch.append((inf, i.id, 'entry', 1))
            
            count += 1
            if count % 2000 == 0:
                print(f"   Processed {count}/{total}...")

        print("[green]Inserting entries into SQLite...")
        self.cursor.executemany(
            "INSERT INTO entries (id, headword, headword_clean, definition_html, grammar_html, example_html, data_json) VALUES (?,?,?,?,?,?,?)",
            entries_batch
        )
        
        print("[green]Inserting lookups into SQLite...")
        self.cursor.executemany(
            "INSERT INTO lookups (key, target_id, target_type, is_inflection) VALUES (?,?,?,?)",
            lookups_batch
        )

        print("[green]Processing Deconstructions...")
        deconstructions = session.query(Lookup).filter(Lookup.deconstructor != "").all()
        
        decon_batch = []
        decon_lookup_batch = []
        
        # [FIXED] Tự sinh ID số nguyên cho Deconstructions vì bảng gốc không có ID
        for idx, d in enumerate(deconstructions, start=1):
            html = self.renderer.render_deconstruction(d)
            split_str = " + ".join(d.deconstructor_unpack_list)
            
            # Sử dụng idx làm ID
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
        
        print("[green]Optimizing Database (VACUUM)...")
        self.conn.execute("VACUUM")
        
        self.conn.close()
        session.close()
        
        print(f"✅ Build Complete: {self.config.output_path}")

def run_builder():
    builder = DictBuilder(mode="mini")
    builder.run()