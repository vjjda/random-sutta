# Path: src/dict_builder/logic/output_database.py
import sqlite3
from datetime import datetime
from rich import print

from ..config import BuilderConfig

class OutputDatabase:
    def __init__(self, config: BuilderConfig):
        self.config = config
        self.conn = None
        self.cursor = None

    def setup(self):
        """Khởi tạo DB, tạo bảng và ghi Metadata."""
        if not self.config.OUTPUT_DIR.exists():
            self.config.OUTPUT_DIR.mkdir(parents=True)
            
        if self.config.output_path.exists():
            self.config.output_path.unlink()
            
        self.conn = sqlite3.connect(self.config.output_path)
        self.cursor = self.conn.cursor()
        
        # Tối ưu hóa tốc độ ghi
        self.cursor.execute("PRAGMA synchronous = OFF")
        self.cursor.execute("PRAGMA journal_mode = MEMORY")
        
        # Load Schema
        schema_path = self.config.TEMPLATES_DIR.parent / "schema.sql"
        with open(schema_path, "r", encoding="utf-8") as f:
            self.cursor.executescript(f.read())
            
        # Ghi Metadata
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", 
                            ("version", datetime.now().strftime("%Y-%m-%d")))
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", 
                            ("mode", self.config.mode))
        self.conn.commit()

    def insert_batch(self, entries: list, lookups: list):
        """Chèn một batch dữ liệu vào DB."""
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
        # Commit ngay hoặc để sau tùy chiến lược, ở đây ta commit luôn để an toàn data
        self.conn.commit()

    def insert_deconstructions(self, deconstructions: list, lookups: list):
        """Chèn dữ liệu Deconstruction."""
        if deconstructions:
            self.cursor.executemany(
                "INSERT INTO deconstructions (id, lookup_key, split_string, html) VALUES (?,?,?,?)",
                deconstructions
            )
        if lookups:
            self.cursor.executemany(
                "INSERT INTO lookups (key, target_id, target_type, is_inflection) VALUES (?,?,?,?)",
                lookups
            )
        self.conn.commit()

    def close(self):
        """Optimize và đóng kết nối."""
        if self.conn:
            print("[green]Indexing & Optimizing (VACUUM)...")
            self.conn.execute("VACUUM")
            self.conn.close()