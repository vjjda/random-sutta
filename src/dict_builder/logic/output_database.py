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
    
    def create_grand_view(self):
        """Tạo View tổng hợp để dễ dàng debug và tra cứu."""
        print("[cyan]Creating 'grand_lookups' view...")
        
        # 1. Xác định tên cột dựa trên Mode (JSON/HTML)
        suffix = "html" if self.config.html_mode else "json"
        
        # Các cột cơ bản của Entries
        # Lưu ý: Tiny mode chỉ có definition
        entry_cols = [
            "e.headword AS entry_headword",
            f"e.definition_{suffix} AS entry_definition"
        ]
        
        if not self.config.is_tiny_mode:
            # Mini/Full có thêm Grammar và Examples
            entry_cols.append(f"e.grammar_{suffix} AS entry_grammar")
            entry_cols.append(f"e.example_{suffix} AS entry_example")
            
        entry_select_str = ",\n            ".join(entry_cols)

        # 2. Câu SQL tạo View
        # Logic: Left Join Lookups với Entries (nếu là headword) VÀ Deconstructions (nếu không phải headword)
        sql = f"""
        CREATE VIEW IF NOT EXISTS grand_lookups AS
        SELECT 
            l.key AS lookup_key,
            l.is_headword,
            l.is_inflection,
            
            -- Thông tin từ Entries (nếu is_headword = 1)
            {entry_select_str},
            
            -- Thông tin từ Deconstructions (nếu is_headword = 0)
            d.split_string AS decon_split,
            d.lookup_key AS decon_key_ref
            
        FROM lookups l
        LEFT JOIN entries e 
            ON l.target_id = e.id AND l.is_headword = 1
        LEFT JOIN deconstructions d 
            ON l.target_id = d.id AND l.is_headword = 0;
        """
        
        try:
            self.cursor.execute("DROP VIEW IF EXISTS grand_lookups;")
            self.cursor.execute(sql)
            self.conn.commit()
        except Exception as e:
            print(f"[red]Failed to create grand view: {e}")

    def close(self):
        if self.conn:
            print("[green]Indexing & Optimizing (VACUUM)...")
            self.conn.execute("VACUUM")
            self.conn.close()