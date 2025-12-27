# Path: src/dict_builder/logic/database/db_manager.py
import sqlite3
import logging
from typing import List, Tuple

from ...builder_config import BuilderConfig
from .schema_manager import SchemaManager
from .data_inserter import DataInserter
from .view_manager import ViewManager

logger = logging.getLogger("dict_builder.db")

class OutputDatabase:
    """
    Facade Class: Quản lý DB Connection và điều phối các Manager con.
    Thay thế cho output_database.py cũ.
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
        """Khởi tạo DB và Schema."""
        if not self.config.OUTPUT_DIR.exists():
            self.config.OUTPUT_DIR.mkdir(parents=True)
        if self.config.output_path.exists():
            self.config.output_path.unlink()
        
        self.conn = sqlite3.connect(self.config.output_path)
        self.cursor = self.conn.cursor()
        
        # Performance settings
        self.cursor.execute("PRAGMA synchronous = OFF")
        self.cursor.execute("PRAGMA journal_mode = MEMORY")
        
        # Init Managers
        self.schema = SchemaManager(self.cursor, self.config)
        self.inserter = DataInserter(self.conn, self.cursor, self.config)
        self.views = ViewManager(self.cursor, self.config, self.schema)
        
        # Run Setup
        self.schema.create_tables()
        self.conn.commit()

    # --- Delegation Methods (Giữ API cũ để không phải sửa code gọi) ---

    def insert_batch(self, entries: List[Tuple], lookups: List[Tuple]) -> None:
        self.inserter.insert_entries_batch(entries, lookups)

    def insert_deconstructions(self, deconstructions: List[Tuple], lookups: List[Tuple]) -> None:
        self.inserter.insert_deconstructions(deconstructions, lookups)

    def insert_roots(self, roots: List[Tuple], lookups: List[Tuple]) -> None:
        self.inserter.insert_roots(roots, lookups)

    def insert_grammar_notes(self, grammar_batch: List[Tuple]) -> None:
        self.inserter.insert_grammar_notes(grammar_batch)

    # --- Closing & Post-processing ---

    def close(self) -> None:
        if self.conn:
            # Recreate views & sort logic before closing
            # Lưu ý: ViewManager cần SchemaManager để tạo lại Trigger
            if not self.views:
                 self.schema = SchemaManager(self.cursor, self.config)
                 self.views = ViewManager(self.cursor, self.config, self.schema)
            
            self.views.create_all_views()
            
            self.conn.commit()
            logger.info("[green]Indexing & Optimizing (VACUUM)...[/green]")
            self.conn.execute("VACUUM")
            self.conn.close()
            
    # Hỗ trợ cho DbConverter tái tạo view
    def create_grand_view(self):
        if self.views: self.views._create_grand_view()
        
    def create_search_procedures(self):
        if self.views: self.views._create_search_procedures()