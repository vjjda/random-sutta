# Path: src/dict_builder/logic/output_database.py
import sqlite3
import logging
from datetime import datetime

from ..config import BuilderConfig
from src.dict_builder.tools.json_key_map import get_key_map_list

logger = logging.getLogger("dict_builder")

class OutputDatabase:
    def __init__(self, config: BuilderConfig):
        self.config = config
        self.conn = None
        self.cursor = None

    def setup(self):
        if not self.config.OUTPUT_DIR.exists():
            self.config.OUTPUT_DIR.mkdir(parents=True)
        if self.config.output_path.exists():
            self.config.output_path.unlink()
        self.conn = sqlite3.connect(self.config.output_path)
        self.cursor = self.conn.cursor()
        self.cursor.execute("PRAGMA synchronous = OFF")
        self.cursor.execute("PRAGMA journal_mode = MEMORY")
        self._create_tables()
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("version", datetime.now().strftime("%Y-%m-%d")))
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("mode", self.config.mode))
        fmt = "html" if self.config.html_mode else "json"
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("format", fmt))
        comp_status = "zlib" if self.config.USE_COMPRESSION else "none"
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("compression", comp_status))
        self.populate_json_keys()
        self.conn.commit()

    def _create_tables(self):
        self.cursor.execute("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT);")
        # [CHANGED] lookup_key -> word
        self.cursor.execute("CREATE TABLE IF NOT EXISTS deconstructions (id INTEGER PRIMARY KEY, word TEXT NOT NULL, split_string TEXT);")
        # [CHANGED] Removed is_inflection
        self.cursor.execute("CREATE TABLE IF NOT EXISTS lookups (key TEXT NOT NULL, target_id INTEGER NOT NULL, is_headword BOOLEAN NOT NULL);")
        
        # [NEW] JSON Keys Map
        self.cursor.execute("CREATE TABLE IF NOT EXISTS json_keys (full_key TEXT PRIMARY KEY, abbr_key TEXT);")

        suffix = "html" if self.config.html_mode else "json"
        
        if self.config.is_tiny_mode:
            sql = f"CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY, headword TEXT NOT NULL, headword_clean TEXT NOT NULL, definition_{suffix} TEXT);"
            self.cursor.execute(sql)
        else:
            sql = f"CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY, headword TEXT NOT NULL, headword_clean TEXT NOT NULL, definition_{suffix} TEXT, grammar_{suffix} TEXT, example_{suffix} TEXT);"
            self.cursor.execute(sql)
        
        self.cursor.execute("CREATE INDEX IF NOT EXISTS idx_lookups_key ON lookups(key);")
        
        if self.config.html_mode:
            self.cursor.execute("CREATE TABLE IF NOT EXISTS grammar_notes (key TEXT PRIMARY KEY, grammar_html TEXT);")
        else:
            self.cursor.execute("CREATE TABLE IF NOT EXISTS grammar_notes (key TEXT PRIMARY KEY, grammar_json TEXT);")

    def populate_json_keys(self):
        """Insert JSON key mappings into the database."""
        key_list = get_key_map_list()
        self.cursor.executemany("INSERT INTO json_keys (full_key, abbr_key) VALUES (?, ?)", key_list)

    def insert_batch(self, entries: list, lookups: list):
        if entries:
            suffix = "html" if self.config.html_mode else "json"
            try:
                if self.config.is_tiny_mode:
                    sql = f"INSERT INTO entries (id, headword, headword_clean, definition_{suffix}) VALUES (?, ?, ?, ?)"
                else:
                    sql = f"INSERT INTO entries (id, headword, headword_clean, definition_{suffix}, grammar_{suffix}, example_{suffix}) VALUES (?, ?, ?, ?, ?, ?)"
                self.cursor.executemany(sql, entries)
            except Exception as e:
                logger.error(f"Entries insert failed. SQL: {sql}")
                if entries:
                    logger.error(f"First entry sample (len {len(entries[0])}): {entries[0]}")
                raise e

        if lookups:
            try:
                # [CHANGED] Removed is_inflection placeholder
                sql_lookups = "INSERT INTO lookups (key, target_id, is_headword) VALUES (?, ?, ?)"
                self.cursor.executemany(sql_lookups, lookups)
            except Exception as e:
                logger.error(f"Lookups insert failed. SQL: {sql_lookups}")
                if lookups:
                    logger.error(f"First lookup sample (len {len(lookups[0])}): {lookups[0]}")
                raise e
        self.conn.commit()

    def insert_deconstructions(self, deconstructions: list, lookups: list):
        if deconstructions:
            self.cursor.executemany("INSERT INTO deconstructions (id, word, split_string) VALUES (?, ?, ?)", deconstructions)
        if lookups:
            # [CHANGED] Removed is_inflection placeholder
            self.cursor.executemany("INSERT INTO lookups (key, target_id, is_headword) VALUES (?, ?, ?)", lookups)
        self.conn.commit()

    def insert_grammar_notes(self, grammar_batch: list):
        if grammar_batch:
            if self.config.html_mode:
                self.cursor.executemany("INSERT INTO grammar_notes (key, grammar_html) VALUES (?, ?)", grammar_batch)
            else:
                self.cursor.executemany("INSERT INTO grammar_notes (key, grammar_json) VALUES (?, ?)", grammar_batch)
        self.conn.commit()

    def create_grand_view(self):
        """Tạo View tổng hợp 'grand_lookups'."""
        logger.info("[cyan]Creating 'grand_lookups' view...")
        
        suffix = "html" if self.config.html_mode else "json"
        
        if self.config.html_mode:
            grammar_field = "gn.grammar_html AS grammar_note_html"
        else:
            grammar_field = "gn.grammar_json AS grammar_note_json"

        entry_cols = []
        entry_cols.append(f"e.definition_{suffix} AS entry_definition")
        
        if not self.config.is_tiny_mode:
            entry_cols.append(f"e.grammar_{suffix} AS entry_grammar")
            entry_cols.append(f"e.example_{suffix} AS entry_example")
            
        entry_select_str = ", ".join(entry_cols)

        # [CHANGED] Removed l.is_inflection
        sql = f"""
        CREATE VIEW IF NOT EXISTS grand_lookups AS
        SELECT 
            l.key AS lookup_key,
            e.headword AS headword,
            l.is_headword,
            d.split_string AS decon_split,
            {grammar_field},
            {entry_select_str}
        FROM lookups l
        LEFT JOIN entries e ON l.target_id = e.id AND l.is_headword = 1
        LEFT JOIN deconstructions d ON l.target_id = d.id AND l.is_headword = 0
        LEFT JOIN grammar_notes gn ON l.key = gn.key;
        """
        
        try:
            self.cursor.execute("DROP VIEW IF EXISTS grand_lookups;")
            self.cursor.execute(sql)
            self.conn.commit()
            logger.info("[green]View 'grand_lookups' created successfully.")
        except Exception as e:
            logger.critical(f"[bold red]❌ Failed to create grand view: {e}")
            logger.debug(f"SQL was: {sql}")

    def close(self):
        if self.conn:
            self.create_grand_view()
            logger.info("[green]Indexing & Optimizing (VACUUM)...")
            self.conn.execute("VACUUM")
            self.conn.close()
