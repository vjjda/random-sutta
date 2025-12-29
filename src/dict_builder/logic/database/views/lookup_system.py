import logging
from sqlite3 import Cursor
from ....builder_config import BuilderConfig

logger = logging.getLogger("dict_builder.views.lookup")

class LookupSystemBuilder:
    def __init__(self, cursor: Cursor, config: BuilderConfig):
        self.cursor = cursor
        self.config = config

    def create(self) -> None:
        """
        Tạo hệ thống Lookup chuyên dụng cho Contextual Lookup (Tra từ nhanh).
        Bao gồm bảng tham số `_lookup_params` và view `view_lookup_results`.
        Logic: Exact Match (FTS) + Deconstruction Union.
        """
        logger.info("[cyan]Injecting Lookup System (Exact + Decon)...[/cyan]")
        try:
            # 1. Tạo bảng tham số riêng biệt cho Lookup
            self.cursor.execute("DROP TABLE IF EXISTS _lookup_params")
            self.cursor.execute("""
                CREATE TABLE _lookup_params (
                    term TEXT
                )
            """)
            # Insert default row
            self.cursor.execute("INSERT INTO _lookup_params (term) VALUES ('')")

            # 2. Xây dựng View
            # Logic:
            # - Priority 0: Deconstruction (từ bảng deconstructions) -> Type -1
            # - Priority 1: Exact Match (từ view_grand_lookups qua lookups_fts) -> Type 0/1
            
            sql_view = """
            CREATE VIEW view_lookup_results AS
            WITH params AS (
                SELECT term FROM _lookup_params LIMIT 1
            )
            -- Main Matches (Priority 1)
            -- Optimize: FTS Lookup first, then Join View, then Group By Target
            SELECT 
                MIN(v.key) as key, -- Pick representative key
                v.target_id, 
                v.type, 
                v.headword, 
                v.definition, 
                v.grammar, 
                v.example, 
                v.gn_grammar, 
                v.root_meaning, 
                v.root_info, 
                v.sanskrit_info,
                1 as priority
            FROM view_grand_lookups v, params p
            WHERE v.key IN (
                SELECT key FROM lookups_fts WHERE key MATCH p.term
            )
            AND v.key = p.term
            GROUP BY v.target_id, v.type;
            """

            self.cursor.execute("DROP VIEW IF EXISTS view_lookup_results")
            self.cursor.execute(sql_view)
            
            logger.info("✅ view_lookup_results created successfully.")
            
        except Exception as e:
            logger.error(f"Failed to inject lookup system: {e}")
