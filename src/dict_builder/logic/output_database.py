# Path: src/dict_builder/logic/output_database.py
import sqlite3
from datetime import datetime
from rich import print

from ..config import BuilderConfig

class OutputDatabase:
    # ... (__init__, setup giữ nguyên) ...
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
        
        # Thêm metadata format
        fmt = "html" if self.config.html_mode else "json"
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("format", fmt))

        comp_status = "zlib" if self.config.USE_COMPRESSION else "none"
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("compression", comp_status))
        self.conn.commit()

    def _create_tables(self):
        self.cursor.execute("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT);")
        self.cursor.execute("CREATE TABLE IF NOT EXISTS deconstructions (id INTEGER PRIMARY KEY, lookup_key TEXT NOT NULL, split_string TEXT);")
        self.cursor.execute("CREATE TABLE IF NOT EXISTS lookups (key TEXT NOT NULL, target_id INTEGER NOT NULL, is_headword BOOLEAN NOT NULL, is_inflection BOOLEAN DEFAULT 0);")

        # [UPDATED] Schema động dựa trên html_mode
        if self.config.is_tiny_mode:
            # Tiny Mode
            col_name = "definition_html" if self.config.html_mode else "definition_json"
            self.cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS entries (
                    id INTEGER PRIMARY KEY,
                    headword TEXT NOT NULL,
                    headword_clean TEXT NOT NULL,
                    {col_name} TEXT
                );
            """)
        else:
            # Mini/Full Mode
            if self.config.html_mode:
                self.cursor.execute("""
                    CREATE TABLE IF NOT EXISTS entries (
                        id INTEGER PRIMARY KEY,
                        headword TEXT NOT NULL,
                        headword_clean TEXT NOT NULL,
                        definition_html TEXT,
                        grammar_html TEXT,
                        example_html TEXT
                    );
                """)
            else:
                self.cursor.execute("""
                    CREATE TABLE IF NOT EXISTS entries (
                        id INTEGER PRIMARY KEY,
                        headword TEXT NOT NULL,
                        headword_clean TEXT NOT NULL,
                        definition_json TEXT,
                        grammar_json TEXT,
                        example_json TEXT
                    );
                """)

        self.cursor.execute("CREATE INDEX IF NOT EXISTS idx_lookups_key ON lookups(key);")


    def insert_batch(self, entries: list, lookups: list):
        if entries:
            # [UPDATED] Insert Statement động
            if self.config.is_tiny_mode:
                col_name = "definition_html" if self.config.html_mode else "definition_json"
                sql = f"INSERT INTO entries (id, headword, headword_clean, {col_name}) VALUES (?,?,?,?)"
            else:
                if self.config.html_mode:
                    sql = "INSERT INTO entries (id, headword, headword_clean, definition_html, grammar_html, example_html) VALUES (?,?,?,?,?,?)"
                else:
                    sql = "INSERT INTO entries (id, headword, headword_clean, definition_json, grammar_json, example_json) VALUES (?,?,?,?,?,?)"
            
            self.cursor.executemany(sql, entries)
                
        if lookups:
            self.cursor.executemany(
                "INSERT INTO lookups (key, target_id, is_headword, is_inflection) VALUES (?,?,?,?)",
                lookups
            )
        self.conn.commit()

    # ... (insert_deconstructions, close giữ nguyên) ...
    def insert_deconstructions(self, deconstructions: list, lookups: list):
        if deconstructions:
            self.cursor.executemany("INSERT INTO deconstructions (id, lookup_key, split_string) VALUES (?,?,?)", deconstructions)
        if lookups:
            self.cursor.executemany("INSERT INTO lookups (key, target_id, is_headword, is_inflection) VALUES (?,?,?,?)", lookups)
        self.conn.commit()

    def close(self):
        if self.conn:
            print("[green]Indexing & Optimizing (VACUUM)...")
            self.conn.execute("VACUUM")
            self.conn.close()