# Path: src/dict_builder/logic/database/view_manager.py
import logging
from sqlite3 import Cursor
from ...builder_config import BuilderConfig

logger = logging.getLogger("dict_builder.views")

class ViewManager:
    # [CLEANUP] Không cần schema_manager nữa
    def __init__(self, cursor: Cursor, config: BuilderConfig):
        self.cursor = cursor
        self.config = config

    # [CLEANUP] Không còn tham số sort=True/False
    def create_all_views(self):
        """Chỉ tập trung vào nhiệm vụ tạo View."""
        self._create_grand_view()
        self._create_search_procedures()

    def _create_grand_view(self) -> None:
        """Tạo View tổng hợp (Content Layer)."""
        logger.info("[cyan]Creating 'grand_lookups' view...[/cyan]")
        
        suffix = "json"
        grammar_note_field = "gn.grammar_pack"
        
        # Definition: Only for Entries (Type 1)
        definition_field = (
            f"CASE "
            f"WHEN l.type = 1 THEN e.definition_{suffix} "
            f"ELSE NULL END AS definition"
        )
        
        headword_field = "CASE WHEN l.type = 1 THEN e.headword WHEN l.type = 0 THEN r.root ELSE NULL END AS headword"
        clean_headword_field = "CASE WHEN l.type = 1 THEN e.headword_clean WHEN l.type = 0 THEN r.root_clean ELSE NULL END AS headword_clean"

        extra_cols = ""
        if not self.config.is_tiny_mode:
            extra_cols = f", e.grammar_{suffix} AS raw_grammar, e.example_{suffix} AS raw_example"

        # Root Columns
        root_cols = "r.root_meaning, r.root_info, r.sanskrit_info"

        sql = f"""
            CREATE VIEW IF NOT EXISTS grand_lookups AS
            SELECT 
                l.key AS lookup_key, l.target_id, l.type AS lookup_type,
                {headword_field}, {clean_headword_field}, {definition_field},
                {grammar_note_field} AS gn_grammar,
                {root_cols}
                {extra_cols}
            FROM lookups l
            LEFT JOIN entries e ON l.target_id = e.id AND l.type = 1
            LEFT JOIN roots r ON l.target_id = r.id AND l.type = 0
            LEFT JOIN grammar_notes gn ON l.key = gn.key;
        """
        
        try:
            self.cursor.execute("DROP VIEW IF EXISTS grand_lookups;")
            self.cursor.execute(sql)
        except Exception as e:
            logger.error(f"Failed to create grand view: {e}")

    def _create_search_procedures(self) -> None:
        """
        Tạo search view thông minh với tham số động hoàn toàn.
        Configurable LIMITs via _search_params table.
        [FIXED] Deduplicate results appearing in both Exact and Prefix matches.
        """
        logger.info("[cyan]Injecting Smart Search Procedures (Dynamic Strategy & Limits)...[/cyan]")
        try:
            # 1. Tạo bảng tham số mở rộng
            self.cursor.execute("DROP TABLE IF EXISTS _search_params")
            self.cursor.execute("""
                CREATE TABLE _search_params (
                    term TEXT,
                    limit_exact INTEGER DEFAULT 20,
                    limit_prefix INTEGER DEFAULT 100,
                    limit_final INTEGER DEFAULT 20
                )
            """)
            self.cursor.execute("""
                INSERT INTO _search_params (term, limit_exact, limit_prefix, limit_final) 
                VALUES ('', 20, 100, 20)
            """)

            suffix = "json"
            
            if self.config.is_tiny_mode:
                cols_raw = "NULL AS grammar, NULL AS example"
            else:
                cols_raw = f"e.grammar_{suffix} AS grammar, e.example_{suffix} AS example"

            # Definition Logic: Only for Entries (Type 1)
            # Roots (Type 0) will have their own columns
            # [FIX] Do NOT define complete CASE statement here to avoid nesting error
            # Just define the logic for Type 1
            def_entry = f"e.definition_{suffix}"
            
            hw_expr = "CASE WHEN m.type = 1 THEN e.headword WHEN m.type = 0 THEN r.root ELSE m.key END"
            clean_hw_expr = "CASE WHEN m.type = 1 THEN e.headword_clean WHEN m.type = 0 THEN r.root_clean ELSE m.key END"
            gn_expr = "gn.grammar_pack"
            
            # Root Columns
            root_cols = "r.root_meaning, r.root_info, r.sanskrit_info"

            sql_view = f"""
            CREATE VIEW view_search_results AS
            WITH input_param AS (
                SELECT term, limit_exact, limit_prefix, limit_final FROM _search_params LIMIT 1
            ),
            -- Priority 0: Deconstruction (Exact Match)
            match_decon AS (
                SELECT 
                    word AS key, 
                    0 AS target_id, 
                    -1 AS type, -- Type -1 for Deconstruction
                    0 AS rank, 
                    0 AS priority
                FROM deconstructions, input_param
                WHERE word = input_param.term
                LIMIT 1
            ),
            -- Priority 1: Exact Match (FTS)
            match_exact AS (
                SELECT key, target_id, type, rank, 1 AS priority
                FROM lookups_fts, input_param
                WHERE lookups_fts MATCH input_param.term
                LIMIT (SELECT limit_exact FROM input_param)
            ),
            -- Priority 2: Prefix Match (Only if term length >= 2)
            match_prefix AS (
                SELECT key, target_id, type, rank, 2 AS priority
                FROM lookups_fts, input_param
                WHERE length(input_param.term) >= 2
                  AND lookups_fts MATCH input_param.term || '*'
                LIMIT (SELECT limit_prefix FROM input_param)
            ),
            -- Combine Results
            all_matches AS (
                SELECT * FROM match_decon
                UNION ALL
                SELECT * FROM match_exact
                UNION ALL
                SELECT * FROM match_prefix
            ),
            -- Deduplicate: Keep the best priority for each (target_id, type)
            unique_matches AS (
                SELECT 
                    key, target_id, type, 
                    MIN(rank) as rank, 
                    MIN(priority) as priority
                FROM all_matches
                GROUP BY target_id, type
                ORDER BY priority ASC, length(key) ASC, rank 
                LIMIT (SELECT limit_final FROM input_param)
            )
            SELECT 
                m.key, m.target_id, m.type,
                -- Headword Logic
                CASE 
                    WHEN m.type = -1 THEN m.key -- Decon
                    WHEN m.type = 1 THEN e.headword
                    WHEN m.type = 0 THEN r.root
                    ELSE m.key
                END AS headword,
                -- Definition Logic
                CASE 
                    WHEN m.type = -1 THEN d.components -- Decon
                    WHEN m.type = 1 THEN {def_entry}   -- Entry
                    ELSE NULL 
                END AS definition,
                {cols_raw},
                {gn_expr} AS gn_grammar,
                {root_cols},
                -- Is Exact Logic
                (m.key = (SELECT term FROM input_param) 
                 AND m.key = CASE 
                    WHEN m.type = 1 THEN e.headword_clean
                    WHEN m.type = 0 THEN r.root_clean
                    ELSE m.key
                 END) AS is_exact
            FROM unique_matches m
            LEFT JOIN entries e ON m.target_id = e.id AND m.type = 1
            LEFT JOIN roots r ON m.target_id = r.id AND m.type = 0
            LEFT JOIN deconstructions d ON m.key = d.word AND m.type = -1
            LEFT JOIN grammar_notes gn ON m.key = gn.key
            ORDER BY m.priority ASC, is_exact DESC, length(m.key) ASC, m.rank;
            """

            self.cursor.execute("DROP VIEW IF EXISTS view_search_results")
            self.cursor.execute(sql_view)
            
        except Exception as e:
            logger.error(f"Failed to inject search procedures: {e}")