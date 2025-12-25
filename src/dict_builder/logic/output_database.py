# Path: src/dict_builder/logic/output_database.py
import sqlite3
from datetime import datetime
from rich import print

from ..config import BuilderConfig

class OutputDatabase:
    # ... (Các phần __init__, setup, _create_tables, insert... giữ nguyên) ...
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
        self.conn.commit()

    def _create_tables(self):
        self.cursor.execute("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT);")
        self.cursor.execute("CREATE TABLE IF NOT EXISTS deconstructions (id INTEGER PRIMARY KEY, lookup_key TEXT NOT NULL, split_string TEXT);")
        self.cursor.execute("CREATE TABLE IF NOT EXISTS lookups (key TEXT NOT NULL, target_id INTEGER NOT NULL, is_headword BOOLEAN NOT NULL, is_inflection BOOLEAN DEFAULT 0);")
        
        suffix = "html" if self.config.html_mode else "json"
        if self.config.is_tiny_mode:
            self.cursor.execute(f"CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY, headword TEXT NOT NULL, headword_clean TEXT NOT NULL, definition_{suffix} TEXT);")
        else:
            self.cursor.execute(f"CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY, headword TEXT NOT NULL, headword_clean TEXT NOT NULL, definition_{suffix} TEXT, grammar_{suffix} TEXT, example_{suffix} TEXT);")
        
        self.cursor.execute("CREATE INDEX IF NOT EXISTS idx_lookups_key ON lookups(key);")
        self.cursor.execute("CREATE TABLE IF NOT EXISTS grammar_notes (key TEXT PRIMARY KEY, grammar_html TEXT, grammar_json TEXT);")

    def insert_batch(self, entries: list, lookups: list):
        if entries:
            suffix = "html" if self.config.html_mode else "json"
            if self.config.is_tiny_mode:
                sql = f"INSERT INTO entries (id, headword, headword_clean, definition_{suffix}) VALUES (?,?,?,?)"
            else:
                sql = f"INSERT INTO entries (id, headword, headword_clean, definition_{suffix}, grammar_{suffix}, example_{suffix}) VALUES (?,?,?,?,?,?)"
            self.cursor.executemany(sql, entries)
        if lookups:
            self.cursor.executemany("INSERT INTO lookups (key, target_id, is_headword, is_inflection) VALUES (?,?,?,?)", lookups)
        self.conn.commit()

    def insert_deconstructions(self, deconstructions: list, lookups: list):
        if deconstructions:
            self.cursor.executemany("INSERT INTO deconstructions (id, lookup_key, split_string) VALUES (?,?,?)", deconstructions)
        if lookups:
            self.cursor.executemany("INSERT INTO lookups (key, target_id, is_headword, is_inflection) VALUES (?,?,?,?)", lookups)
        self.conn.commit()

    def insert_grammar_notes(self, grammar_batch: list):
        if grammar_batch:
            self.cursor.executemany("INSERT INTO grammar_notes (key, grammar_html, grammar_json) VALUES (?,?,?)", grammar_batch)
        self.conn.commit()

    def create_grand_view(self):
        """Tạo View tổng hợp 'grand_lookups'."""
        print("[cyan]Creating 'grand_lookups' view...")
        
        suffix = "html" if self.config.html_mode else "json"
        
        # Xây dựng danh sách cột cho bảng Entries
        entry_cols = ["e.headword AS entry_headword"]
        entry_cols.append(f"e.definition_{suffix} AS entry_definition")
        
        if not self.config.is_tiny_mode:
            entry_cols.append(f"e.grammar_{suffix} AS entry_grammar")
            entry_cols.append(f"e.example_{suffix} AS entry_example")
            
        entry_select_str = ",\n            ".join(entry_cols)

        # [UPDATED] Sắp xếp lại thứ tự cột và thêm ORDER BY
        sql = f"""
        CREATE VIEW IF NOT EXISTS grand_lookups AS
        SELECT 
            l.key AS lookup_key,
            l.is_headword,
            l.is_inflection,
            
            -- [CHANGED] Đưa Deconstruction lên trước
            d.split_string AS decon_split,
            d.lookup_key AS decon_key_ref,
            
            -- Grammar Notes
            gn.grammar_html AS grammar_note_html,
            gn.grammar_json AS grammar_note_json,

            -- [CHANGED] Đưa Entries xuống sau
            {entry_select_str}
            
        FROM lookups l
        LEFT JOIN entries e 
            ON l.target_id = e.id AND l.is_headword = 1
        LEFT JOIN deconstructions d 
            ON l.target_id = d.id AND l.is_headword = 0
        LEFT JOIN grammar_notes gn
            ON l.key = gn.key
            
        -- [CHANGED] Sắp xếp theo lookup_key
        ORDER BY l.key ASC;
        """
        
        try:
            self.cursor.execute("DROP VIEW IF EXISTS grand_lookups;")
            self.cursor.execute(sql)
            self.conn.commit()
            print("[green]View 'grand_lookups' created successfully.")
        except Exception as e:
            print(f"[bold red]❌ Failed to create grand view: {e}")
            print(f"[yellow]SQL was:\n{sql}")

    def close(self):
        if self.conn:
            self.create_grand_view()
            print("[green]Indexing & Optimizing (VACUUM)...")
            self.conn.execute("VACUUM")
            self.conn.close()