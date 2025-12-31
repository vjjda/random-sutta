# Path: src/dict_builder/logic/database/table_manager.py
import logging
from sqlite3 import Cursor
from src.dict_builder.tools.pali_sort_key import pali_sort_key

logger = logging.getLogger("dict_builder.tables")

class TableManager:
    def __init__(self, cursor: Cursor, schema_manager):
        self.cursor = cursor
        self.schema_manager = schema_manager

    def sort_lookups_table(self) -> None:
        """
        Sắp xếp bảng Lookups theo thứ tự Pali (Physical Re-ordering).
        Việc này giúp dữ liệu nằm liền mạch trên đĩa, tối ưu hóa I/O khi query range.
        """
        logger.info("[yellow]Re-sorting 'lookups' table (Python Pali Sort)...[/yellow]")
        try:
            # 1. Fetch ALL lookups (including inflection_map)
            self.cursor.execute("SELECT key, target_id, type, inflection_map FROM lookups")
            rows = self.cursor.fetchall()
            
            # 2. Sort using Python Pali Key
            # Sort by LENGTH first, then Alphabet.
            rows.sort(key=lambda x: (len(x[0]), pali_sort_key(x[0])))
            
            # 3. Drop Trigger (để insert nhanh hơn và tránh trigger chạy đè FTS liên tục)
            self.cursor.execute("DROP TRIGGER IF EXISTS lookups_ai")
            
            # 4. Truncate tables
            self.cursor.execute("DELETE FROM lookups")
            self.cursor.execute("DELETE FROM lookups_fts")
            
            # 5. Re-insert
            logger.info(f"   Inserting {len(rows)} sorted rows into 'lookups'...")
            self.cursor.executemany("INSERT INTO lookups (key, target_id, type, inflection_map) VALUES (?, ?, ?, ?)", rows)
            
            # 6. Populate FTS (Bulk insert)
            # FTS only needs key, target_id, type
            logger.info("   Populating 'lookups_fts'...")
            self.cursor.execute("INSERT INTO lookups_fts (key, target_id, type) SELECT key, target_id, type FROM lookups")
            
            # 7. Re-create Trigger (Gọi SchemaManager)
            self.schema_manager.create_lookup_trigger()
            
            logger.info(f"[green]Lookups & FTS tables sorted and rebuilt successfully.[/green]")
            
        except Exception as e:
            logger.error(f"[red]Failed to sort lookups table: {e}")