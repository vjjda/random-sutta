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
        
        definition_field = (
            f"CASE "
            f"WHEN l.type = 1 THEN e.definition_{suffix} "
            f"WHEN l.type = 0 THEN r.definition_{suffix} "
            f"ELSE NULL END AS definition"
        )
        
        headword_field = "CASE WHEN l.type = 1 THEN e.headword WHEN l.type = 0 THEN r.root ELSE NULL END AS headword"
        clean_headword_field = "CASE WHEN l.type = 1 THEN e.headword_clean WHEN l.type = 0 THEN r.root_clean ELSE NULL END AS headword_clean"

        extra_cols = ""
        if not self.config.is_tiny_mode:
            extra_cols = f", e.grammar_{suffix} AS raw_grammar, e.example_{suffix} AS raw_example"

        sql = f"""
            CREATE VIEW IF NOT EXISTS grand_lookups AS
            SELECT 
                l.key AS lookup_key, l.target_id, l.type AS lookup_type,
                {headword_field}, {clean_headword_field}, {definition_field},
                {grammar_note_field} AS gn_grammar
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

            def_expr = f"CASE WHEN matches.type = 1 THEN e.definition_{suffix} WHEN matches.type = 0 THEN r.definition_{suffix} ELSE NULL END"
            hw_expr = "CASE WHEN matches.type = 1 THEN e.headword WHEN matches.type = 0 THEN r.root ELSE matches.key END"
            clean_hw_expr = "CASE WHEN matches.type = 1 THEN e.headword_clean WHEN matches.type = 0 THEN r.root_clean ELSE matches.key END"
            gn_expr = "gn.grammar_pack"

            sql_view = f"""
            CREATE VIEW view_search_results AS
            WITH input_param AS (
                SELECT term, limit_exact, limit_prefix, limit_final FROM _search_params LIMIT 1
            ),
            match_short AS (
                -- Strategy 1: Short Term (< 2 chars) -> Exact Match Only
                SELECT key, target_id, type, rank, 0 AS priority
                FROM lookups_fts, input_param
                WHERE length(input_param.term) < 2
                  AND lookups_fts MATCH input_param.term
                LIMIT (SELECT limit_exact FROM input_param)
            ),
            match_long_exact AS (
                -- Strategy 2a: Exact Match
                SELECT key, target_id, type, rank, 1 AS priority
                FROM lookups_fts, input_param
                WHERE length(input_param.term) >= 2
                  AND lookups_fts MATCH input_param.term
                LIMIT (SELECT limit_exact FROM input_param)
            ),
            match_long_prefix AS (
                -- Strategy 2b: Prefix Match
                SELECT key, target_id, type, rank, 2 AS priority
                FROM lookups_fts, input_param
                WHERE length(input_param.term) >= 2
                  AND lookups_fts MATCH input_param.term || '*'
                LIMIT (SELECT limit_prefix FROM input_param)
            ),
            all_raw_matches AS (
                SELECT * FROM match_short
                UNION ALL
                SELECT * FROM match_long_exact
                UNION ALL
                SELECT * FROM match_long_prefix
            ),
            final_ids AS (
                -- [FIX] GROUP BY để khử trùng lặp
                -- Nếu một từ xuất hiện ở cả Exact (prio 1) và Prefix (prio 2),
                -- lệnh MIN(priority) sẽ giữ lại Priority 1 (tốt hơn).
                SELECT 
                    key, 
                    target_id, 
                    type, 
                    MIN(rank) as rank, 
                    MIN(priority) as priority
                FROM all_raw_matches
                GROUP BY target_id, type
                ORDER BY priority ASC, length(key) ASC, rank 
                LIMIT (SELECT limit_final FROM input_param) -- Dynamic Limit
            )
            SELECT 
                matches.key, matches.target_id, matches.type,
                {hw_expr} AS headword,
                {def_expr} AS definition,
                {cols_raw},
                {gn_expr} AS gn_grammar,
                (matches.key = (SELECT term FROM input_param) 
                 AND matches.key = COALESCE({clean_hw_expr}, matches.key)) AS is_exact
            FROM final_ids matches
            LEFT JOIN entries e ON matches.target_id = e.id AND matches.type = 1
            LEFT JOIN roots r ON matches.target_id = r.id AND matches.type = 0
            LEFT JOIN grammar_notes gn ON matches.key = gn.key
            ORDER BY matches.priority ASC, is_exact DESC, length(matches.key) ASC, matches.rank;
            """

            self.cursor.execute("DROP VIEW IF EXISTS view_search_results")
            self.cursor.execute(sql_view)
            
        except Exception as e:
            logger.error(f"Failed to inject search procedures: {e}")