# Path: src/dict_builder/logic/database/view_manager.py
import logging
from sqlite3 import Cursor
from ...builder_config import BuilderConfig
from src.dict_builder.tools.pali_sort_key import pali_sort_key

logger = logging.getLogger("dict_builder.views")

class ViewManager:
    def __init__(self, cursor: Cursor, config: BuilderConfig, schema_manager):
        self.cursor = cursor
        self.config = config
        self.schema_manager = schema_manager # Need to recreate trigger after sort

    def create_all_views(self):
        self._sort_lookups_table()
        self._create_grand_view()
        self._create_search_procedures()

    def _create_grand_view(self) -> None:
        """Tạo View tổng hợp (Content Layer)."""
        logger.info("[cyan]Creating 'grand_lookups' view...[/cyan]")
        suffix = "html" if self.config.html_mode else "json"
        
        grammar_note_field = "gn.grammar_html" if self.config.html_mode else "gn.grammar_pack"
        
        # Unified Definition
        definition_field = (
            f"CASE "
            f"WHEN l.type = 0 THEN d.components "
            f"WHEN l.type = 1 THEN e.definition_{suffix} "
            f"WHEN l.type = 2 THEN r.definition_{suffix} "
            f"ELSE NULL END AS definition"
        )
        
        # Headword & Clean Headword Logic
        headword_field = "CASE WHEN l.type = 1 THEN e.headword WHEN l.type = 2 THEN r.root ELSE NULL END AS headword"
        clean_headword_field = "CASE WHEN l.type = 1 THEN e.headword_clean WHEN l.type = 0 THEN d.word WHEN l.type = 2 THEN r.root_clean ELSE NULL END AS headword_clean"

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
            LEFT JOIN deconstructions d ON l.target_id = d.id AND l.type = 0
            LEFT JOIN roots r ON l.target_id = r.id AND l.type = 2
            LEFT JOIN grammar_notes gn ON l.key = gn.key;
        """
        
        try:
            self.cursor.execute("DROP VIEW IF EXISTS grand_lookups;")
            self.cursor.execute(sql)
        except Exception as e:
            logger.error(f"Failed to create grand view: {e}")

    def _create_search_procedures(self) -> None:
        """Tạo search view tối ưu (Inline Joins)."""
        logger.info("[cyan]Injecting Optimized Search Procedures...[/cyan]")
        try:
            self.cursor.execute("DROP TABLE IF EXISTS _search_params")
            self.cursor.execute("CREATE TABLE _search_params (term TEXT)")
            self.cursor.execute("INSERT INTO _search_params (term) VALUES ('')")

            suffix = "html" if self.config.html_mode else "json"
            
            # Select Columns
            if self.config.is_tiny_mode:
                cols_raw = "NULL AS grammar, NULL AS example"
            else:
                cols_raw = f"e.grammar_{suffix} AS grammar, e.example_{suffix} AS example"

            # Expressions (Inline Logic)
            def_expr = f"CASE WHEN matches.type = 0 THEN d.components WHEN matches.type = 1 THEN e.definition_{suffix} WHEN matches.type = 2 THEN r.definition_{suffix} ELSE NULL END"
            hw_expr = "CASE WHEN matches.type = 1 THEN e.headword WHEN matches.type = 2 THEN r.root ELSE matches.key END"
            clean_hw_expr = "CASE WHEN matches.type = 1 THEN e.headword_clean WHEN matches.type = 0 THEN d.word WHEN matches.type = 2 THEN r.root_clean ELSE matches.key END"
            gn_expr = "gn.grammar_html" if self.config.html_mode else "gn.grammar_pack"

            sql_view = f"""
            CREATE VIEW view_search_results AS
            WITH input_param AS (SELECT term FROM _search_params LIMIT 1),
            ft_results AS (
                SELECT * FROM (
                    SELECT key, target_id, type, rank, 1 AS priority FROM lookups_fts WHERE lookups_fts MATCH (SELECT term FROM input_param) LIMIT 20
                ) UNION ALL SELECT * FROM (
                    SELECT key, target_id, type, rank, 2 AS priority FROM lookups_fts WHERE lookups_fts MATCH (SELECT term FROM input_param) || '*' LIMIT 100
                )
            ),
            final_ids AS (
                SELECT key, target_id, type, rank, priority FROM ft_results ORDER BY priority ASC, length(key) ASC, rank LIMIT 20
            )
            SELECT 
                matches.key, matches.target_id, matches.type,
                {hw_expr} AS headword,
                {def_expr} AS definition,
                {cols_raw},
                {gn_expr} AS gn_grammar,
                (matches.key = (SELECT term FROM input_param) AND matches.key = COALESCE({clean_hw_expr}, matches.key)) AS is_exact
            FROM final_ids matches
            LEFT JOIN entries e ON matches.target_id = e.id AND matches.type = 1
            LEFT JOIN deconstructions d ON matches.target_id = d.id AND matches.type = 0
            LEFT JOIN roots r ON matches.target_id = r.id AND matches.type = 2
            LEFT JOIN grammar_notes gn ON matches.key = gn.key
            ORDER BY matches.priority ASC, is_exact DESC, length(matches.key) ASC, matches.rank;
            """

            self.cursor.execute("DROP VIEW IF EXISTS view_search_results")
            self.cursor.execute(sql_view)
            
        except Exception as e:
            logger.error(f"Failed to inject search procedures: {e}")

    def _sort_lookups_table(self) -> None:
        """Sort bảng Lookups bằng Python logic."""
        logger.info("[yellow]Re-sorting 'lookups' table (Python Pali Sort)...[/yellow]")
        try:
            self.cursor.execute("SELECT key, target_id, type FROM lookups")
            rows = self.cursor.fetchall()
            rows.sort(key=lambda x: (len(x[0]), pali_sort_key(x[0])))
            
            self.cursor.execute("DROP TRIGGER IF EXISTS lookups_ai")
            self.cursor.execute("DELETE FROM lookups")
            self.cursor.execute("DELETE FROM lookups_fts")
            
            logger.info(f"   Inserting {len(rows)} sorted rows...")
            self.cursor.executemany("INSERT INTO lookups (key, target_id, type) VALUES (?, ?, ?)", rows)
            
            self.cursor.execute("INSERT INTO lookups_fts (key, target_id, type) SELECT key, target_id, type FROM lookups")
            
            # Re-enable Trigger via Schema Manager
            self.schema_manager.create_lookup_trigger()
            
        except Exception as e:
            logger.error(f"Failed to sort lookups: {e}")