# Path: src/dict_builder/logic/database/db_manager.py
import sqlite3
import logging
from typing import List, Tuple
from pathlib import Path

from ...builder_config import BuilderConfig
from .schema_manager import SchemaManager
from .data_inserter import DataInserter
from .view_manager import ViewManager

logger = logging.getLogger("dict_builder.db")

class OutputDatabase:
    """
    Facade Class: Quản lý DB Connection và điều phối các Manager con.
    """
    def __init__(self, config: BuilderConfig):
        self.config = config
        self.conn: sqlite3.Connection | None = None
        self.cursor: sqlite3.Cursor | None = None
        
        # Sub-managers
        self.schema: SchemaManager | None = None
        self.inserter: DataInserter | None = None
        self.views: ViewManager | None = None

    def setup(self) -> None:
        """Khởi tạo DB MỚI (Xóa cũ nếu có). Dùng cho quá trình Build Data."""
        if not self.config.OUTPUT_DIR.exists():
            self.config.OUTPUT_DIR.mkdir(parents=True)
        if self.config.output_path.exists():
            self.config.output_path.unlink()
        
        self._connect()
        
        # Init Managers & Schema
        self.schema = SchemaManager(self.cursor, self.config)
        self.inserter = DataInserter(self.conn, self.cursor, self.config)
        self.views = ViewManager(self.cursor, self.config, self.schema)
        
        self.schema.create_tables()
        self.conn.commit()

    def connect_to_existing(self) -> bool:
        """Kết nối vào DB ĐÃ CÓ. Dùng cho quá trình Inject View."""
        if not self.config.output_path.exists():
            logger.error(f"Database not found at: {self.config.output_path}")
            return False
            
        self._connect()
        
        # Init Managers (Schema cần thiết để tạo lại Trigger)
        self.schema = SchemaManager(self.cursor, self.config)
        self.views = ViewManager(self.cursor, self.config, self.schema)
        # Không init Inserter vì không dùng đến
        
        return True

    def _connect(self):
        """Internal helper to establish connection."""
        self.conn = sqlite3.connect(self.config.output_path)
        self.cursor = self.conn.cursor()
        self.cursor.execute("PRAGMA synchronous = OFF")
        self.cursor.execute("PRAGMA journal_mode = MEMORY")

    # --- Delegation Methods ---

    def insert_batch(self, entries: List[Tuple], lookups: List[Tuple]) -> None:
        if self.inserter: self.inserter.insert_entries_batch(entries, lookups)

    def insert_deconstructions(self, deconstructions: List[Tuple], lookups: List[Tuple]) -> None:
        if self.inserter: self.inserter.insert_deconstructions(deconstructions, lookups)

    def insert_roots(self, roots: List[Tuple], lookups: List[Tuple]) -> None:
        if self.inserter: self.inserter.insert_roots(roots, lookups)

    def insert_grammar_notes(self, grammar_batch: List[Tuple]) -> None:
        if self.inserter: self.inserter.insert_grammar_notes(grammar_batch)

    # --- Logic Operations ---

    def refresh_views(self) -> None:
        """Chỉ chạy lại logic tạo View (Không đụng đến data)."""
        if self.views:
            # [UPDATED] sort=False vì dữ liệu đã được sort khi build rồi
            self.views.create_all_views(sort=False)
            self.conn.commit()
            
            logger.info("[green]Optimizing (VACUUM)...[/green]")
            self.conn.execute("VACUUM")

    def close(self) -> None:
        if self.conn:
            # Nếu đang ở chế độ build full (có inserter), ta CẦN sort (sort=True mặc định)
            if self.inserter:
                if not self.views:
                     # Init views manager if not exists (case of lazy init)
                     self.views = ViewManager(self.cursor, self.config, self.schema)
                
                # [NOTE] Build mới thì vẫn Sort như bình thường
                self.views.create_all_views(sort=True)
                
                self.conn.commit()
                logger.info("[green]Indexing & Optimizing (VACUUM)...[/green]")
                self.conn.execute("VACUUM")
            
            self.conn.close()