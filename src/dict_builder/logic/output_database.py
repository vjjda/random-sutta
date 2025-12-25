# Path: src/dict_builder/logic/output_database.py
import sqlite3
import logging
from datetime import datetime

from ..builder_config import BuilderConfig
from src.dict_builder.tools.json_key_map import get_key_map_list
from src.dict_builder.tools.pali_sort_key import pali_sort_key

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
        self.cursor.execute("CREATE TABLE IF NOT EXISTS deconstructions (id INTEGER PRIMARY KEY, word TEXT NOT NULL, split_string TEXT);")
        self.cursor.execute("CREATE TABLE IF NOT EXISTS lookups (key TEXT NOT NULL, target_id INTEGER NOT NULL, type INTEGER NOT NULL);")
        self.cursor.execute("CREATE TABLE IF NOT EXISTS json_keys (abbr_key TEXT PRIMARY KEY, full_key TEXT);")

        suffix = "html" if self.config.html_mode else "json"
        
        if self.config.is_tiny_mode:
            sql = "CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY, headword TEXT NOT NULL, headword_clean TEXT NOT NULL, definition_" + suffix + " TEXT);"
            self.cursor.execute(sql)
        else:
            sql = "CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY, headword TEXT NOT NULL, headword_clean TEXT NOT NULL, definition_" + suffix + " TEXT, grammar_" + suffix + " TEXT, example_" + suffix + " TEXT);"
            self.cursor.execute(sql)
            
        sql_roots = "CREATE TABLE IF NOT EXISTS roots (id INTEGER PRIMARY KEY, root TEXT NOT NULL, definition_" + suffix + " TEXT);"
        self.cursor.execute(sql_roots)
        
        self.cursor.execute("CREATE INDEX IF NOT EXISTS idx_lookups_key ON lookups(key);")
        
        # FTS5 for Full Text Search
        self.cursor.execute("CREATE VIRTUAL TABLE IF NOT EXISTS lookups_fts USING fts5(key, target_id UNINDEXED, type UNINDEXED, tokenize='unicode61 remove_diacritics 2');")
        
        # Trigger creation
        self._create_lookup_trigger()
        
        if self.config.html_mode:
            self.cursor.execute("CREATE TABLE IF NOT EXISTS grammar_notes (key TEXT PRIMARY KEY, grammar_html TEXT);")
        else:
            self.cursor.execute("CREATE TABLE IF NOT EXISTS grammar_notes (key TEXT PRIMARY KEY, grammar_json TEXT);")

    def _create_lookup_trigger(self):
        """Helper to create the trigger."""
        self.cursor.execute("DROP TRIGGER IF EXISTS lookups_ai")
        self.cursor.execute("""
            CREATE TRIGGER lookups_ai AFTER INSERT ON lookups BEGIN
                INSERT INTO lookups_fts(key, target_id, type) VALUES (new.key, new.target_id, new.type);
            END;
        """)

    def populate_json_keys(self):
        key_list = get_key_map_list()
        swapped_list = sorted([(abbr, full) for full, abbr in key_list], key=lambda x: x[0])
        self.cursor.executemany("INSERT INTO json_keys (abbr_key, full_key) VALUES (?, ?)", swapped_list)

    def insert_batch(self, entries: list, lookups: list):
        if entries:
            suffix = "html" if self.config.html_mode else "json"
            try:
                if self.config.is_tiny_mode:
                    sql = "INSERT INTO entries (id, headword, headword_clean, definition_" + suffix + ") VALUES (?, ?, ?, ?)"
                else:
                    sql = "INSERT INTO entries (id, headword, headword_clean, definition_" + suffix + ", grammar_" + suffix + ", example_" + suffix + ") VALUES (?, ?, ?, ?, ?, ?)"
                self.cursor.executemany(sql, entries)
            except Exception as e:
                logger.error(f"Entries insert failed. SQL: {sql}")
                raise e

        if lookups:
            try:
                sql_lookups = "INSERT INTO lookups (key, target_id, type) VALUES (?, ?, ?)"
                self.cursor.executemany(sql_lookups, lookups)
            except Exception as e:
                logger.error(f"Lookups insert failed. SQL: {sql_lookups}")
                raise e
        self.conn.commit()

    def insert_deconstructions(self, deconstructions: list, lookups: list):
        if deconstructions:
            self.cursor.executemany("INSERT INTO deconstructions (id, word, split_string) VALUES (?, ?, ?)", deconstructions)
        if lookups:
            self.cursor.executemany("INSERT INTO lookups (key, target_id, type) VALUES (?, ?, ?)", lookups)
        self.conn.commit()

    def insert_roots(self, roots: list, lookups: list):
        if roots:
            suffix = "html" if self.config.html_mode else "json"
            sql = "INSERT INTO roots (id, root, definition_" + suffix + ") VALUES (?, ?, ?)"
            self.cursor.executemany(sql, roots)
        
        if lookups:
            self.cursor.executemany("INSERT INTO lookups (key, target_id, type) VALUES (?, ?, ?)", lookups)
        self.conn.commit()

    def insert_grammar_notes(self, grammar_batch: list):
        if grammar_batch:
            if self.config.html_mode:
                self.cursor.executemany("INSERT INTO grammar_notes (key, grammar_html) VALUES (?, ?)", grammar_batch)
            else:
                self.cursor.executemany("INSERT INTO grammar_notes (key, grammar_json) VALUES (?, ?)", grammar_batch)
        self.conn.commit()

    def create_grand_view(self):
        logger.info("[cyan]Creating 'grand_lookups' view (Unified Definition)...[/cyan]")
        
        suffix = "html" if self.config.html_mode else "json"
        
        # 1. Grammar Note Field
        if self.config.html_mode:
            grammar_note_field = "gn.grammar_html AS grammar_note"
        else:
            grammar_note_field = "gn.grammar_json AS grammar_note"

        # 2. Unified Definition Field (Using CASE WHEN)
        # Type 0 = Deconstruction, 1 = Entry, 2 = Root
        definition_field = (
            f"CASE "
            f"WHEN l.type = 0 THEN d.split_string "
            f"WHEN l.type = 1 THEN e.definition_{suffix} "
            f"WHEN l.type = 2 THEN r.definition_{suffix} "
            f"ELSE NULL END AS definition"
        )
        
        # 3. Unified Headword Field
        headword_field = (
            "CASE "
            "WHEN l.type = 1 THEN e.headword "
            "WHEN l.type = 2 THEN r.root "
            "ELSE NULL END AS headword"
        )

        # 4. Extra columns for Entries (Grammar/Example) - Only if not Tiny Mode
        extra_entry_cols = ""
        if not self.config.is_tiny_mode:
            extra_entry_cols = f", e.grammar_{suffix} AS entry_grammar, e.example_{suffix} AS entry_example"

        # [UPDATED] View with UNIFIED 'definition' column
        sql = f"""
            CREATE VIEW IF NOT EXISTS grand_lookups AS
            SELECT 
                l.key AS lookup_key, 
                l.target_id, 
                l.type AS lookup_type,
                {headword_field},
                {definition_field},
                {grammar_note_field}
                {extra_entry_cols}
            FROM lookups l
            LEFT JOIN entries e ON l.target_id = e.id AND l.type = 1
            LEFT JOIN deconstructions d ON l.target_id = d.id AND l.type = 0
            LEFT JOIN roots r ON l.target_id = r.id AND l.type = 2
            LEFT JOIN grammar_notes gn ON l.key = gn.key;
        """
        
        try:
            self.cursor.execute("DROP VIEW IF EXISTS grand_lookups;")
            self.cursor.execute(sql)
            self.conn.commit()
            logger.info("[green]View 'grand_lookups' created successfully.[/green]")
        except Exception as e:
            logger.critical(f"[bold red]❌ Failed to create grand view: {e}")
            logger.debug(f"SQL was: {sql}")

    def _sort_lookups_table_python_side(self):
        """
        Sắp xếp bảng Lookups theo Pali Sort Key (Python Side).
        """
        logger.info("[yellow]Re-sorting 'lookups' table (Python Pali Sort)...[/yellow]")
        
        try:
            # 1. Fetch ALL lookups
            self.cursor.execute("SELECT key, target_id, type FROM lookups")
            rows = self.cursor.fetchall()
            
            # 2. Sort using Python Pali Key
            rows.sort(key=lambda x: pali_sort_key(x[0]))
            
            # 3. Drop Trigger
            self.cursor.execute("DROP TRIGGER IF EXISTS lookups_ai")
            
            # 4. Truncate tables
            self.cursor.execute("DELETE FROM lookups")
            self.cursor.execute("DELETE FROM lookups_fts")
            
            # 5. Re-insert
            logger.info(f"   Inserting {len(rows)} sorted rows into 'lookups'...")
            self.cursor.executemany("INSERT INTO lookups (key, target_id, type) VALUES (?, ?, ?)", rows)
            
            # 6. Populate FTS
            logger.info("   Populating 'lookups_fts'...")
            self.cursor.execute("INSERT INTO lookups_fts (key, target_id, type) SELECT key, target_id, type FROM lookups")
            
            # 7. Re-create Trigger
            self._create_lookup_trigger()
            
            self.conn.commit()
            logger.info(f"[green]Lookups & FTS tables sorted and rebuilt successfully.[/green]")
            
        except Exception as e:
            logger.error(f"[red]Failed to sort lookups table: {e}")

    def close(self):
        if self.conn:
            self._sort_lookups_table_python_side()
            self.create_grand_view()
            logger.info("[green]Indexing & Optimizing (VACUUM)...[/green]")
            self.conn.execute("VACUUM")
            self.conn.close()