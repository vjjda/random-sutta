# Path: src/dict_builder/logic/database/db_manager.py
import sqlite3
import logging
from typing import List, Tuple

from ...builder_config import BuilderConfig
from .schema_manager import SchemaManager
from .data_inserter import DataInserter
from .view_manager import ViewManager
from .table_manager import TableManager  # [NEW]

logger = logging.getLogger("dict_builder.db")

class OutputDatabase:
    def __init__(self, config: BuilderConfig):
        self.config = config
        self.conn: sqlite3.Connection | None = None
        self.cursor: sqlite3.Cursor | None = None
        
        # Sub-managers
        self.schema: SchemaManager | None = None
        self.inserter: DataInserter | None = None
        self.views: ViewManager | None = None
        self.tables: TableManager | None = None # [NEW]

    def setup(self) -> None:
        """Khởi tạo DB MỚI (Build Mode)."""
        if not self.config.OUTPUT_DIR.exists():
            self.config.OUTPUT_DIR.mkdir(parents=True)
        if self.config.output_path.exists():
            self.config.output_path.unlink()
        
        self._connect()
        
        # Init Managers
        self.schema = SchemaManager(self.cursor, self.config)
        self.inserter = DataInserter(self.conn, self.cursor, self.config)
        # ViewManager giờ không cần schema_manager nữa
        self.views = ViewManager(self.cursor, self.config)
        # TableManager cần schema_manager để handle trigger
        self.tables = TableManager(self.cursor, self.schema)
        
        self.schema.create_tables()
        self.conn.commit()

    def connect_to_existing(self) -> bool:
        """Kết nối DB CŨ (Inject Mode)."""
        if not self.config.output_path.exists():
            return False
        self._connect()
        self.views = ViewManager(self.cursor, self.config)
        # Không init TableManager ở đây vì Inject Mode KHÔNG CẦN SORT
        return True

    def _connect(self):
        self.conn = sqlite3.connect(self.config.output_path)
        self.cursor = self.conn.cursor()
        self.cursor.execute("PRAGMA synchronous = OFF")
        self.cursor.execute("PRAGMA journal_mode = MEMORY")

    # --- Delegation Methods (Insert) ---
    def insert_batch(self, entries, lookups):
        if self.inserter: self.inserter.insert_entries_batch(entries, lookups)
    def insert_deconstructions(self, deconstructions, lookups):
        if self.inserter: self.inserter.insert_deconstructions(deconstructions, lookups)
    def insert_roots(self, roots, lookups):
        if self.inserter: self.inserter.insert_roots(roots, lookups)
    def insert_grammar_notes(self, grammar_batch):
        if self.inserter: self.inserter.insert_grammar_notes(grammar_batch)

    # --- Logic Operations ---

    def refresh_views(self) -> None:
        """Chạy khi mode -v (Inject View)."""
        if self.views:
            # Chỉ tạo View, không Sort
            self.views.create_all_views()
            self.conn.commit()
            logger.info("[green]Optimizing (VACUUM)...[/green]")
            self.conn.execute("VACUUM")

    def close(self) -> None:
        """Chạy khi kết thúc Build Mode (-m)."""
        if self.conn:
            # Nếu có inserter nghĩa là đang ở Build Mode -> Cần Sort
            if self.inserter:
                if not self.tables:
                     # Fallback init
                     self.schema = SchemaManager(self.cursor, self.config)
                     self.tables = TableManager(self.cursor, self.schema)
                
                # 1. SORT (Physical Data Optimization)
                self.tables.sort_lookups_table()
                
                if not self.views:
                    self.views = ViewManager(self.cursor, self.config)

                # 2. CREATE VIEWS (Logical Definition)
                self.views.create_all_views()
                
                self.conn.commit()
                logger.info("[green]Indexing & Optimizing (VACUUM)...[/green]")
                self.conn.execute("VACUUM")
            
            self.conn.close()