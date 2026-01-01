# Path: src/dict_builder/logic/database/views/search_system.py
import logging
from sqlite3 import Cursor
from ....builder_config import BuilderConfig

logger = logging.getLogger("dict_builder.views.search")

class SearchSystemBuilder:
    def __init__(self, cursor: Cursor, config: BuilderConfig):
        self.cursor = cursor
        self.config = config

    def create(self) -> None:
        """
        Tạo hệ thống tìm kiếm thông minh với tham số động.
        Bao gồm bảng tham số `_search_params` và view `view_search_results`.
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

            # --- COLUMN DEFINITIONS ---

            # Headword Logic
            col_headword = """
                CASE 
                    WHEN k.type = -1 THEN k.key 
                    WHEN k.type = 1 THEN e.headword
                    WHEN k.type = 0 THEN r.root
                    WHEN k.type = -2 THEN k.key
                    ELSE k.key
                END AS headword
            """

            # POS
            col_pos = "CASE WHEN k.type = 1 THEN e.pos WHEN k.type = 0 THEN 'root' ELSE NULL END AS pos"
            
            # Meaning
            col_meaning = """
                CASE 
                    WHEN k.type = 1 THEN e.meaning 
                    WHEN k.type = 0 THEN r.root_meaning 
                    WHEN k.type = -1 THEN d.components
                    ELSE NULL 
                END AS meaning
            """
            
            # Meaning Origin
            col_origin = "CASE WHEN k.type = 1 THEN e.meaning_lit WHEN k.type = 0 THEN r.sanskrit_root_meaning ELSE NULL END AS meaning_origin"
            
            # Entry Info (Mapped from flattened columns)
            col_entry_info = """
                e.grammar,
                e.construction,
                e.degree,
                e.plus_case,
                e.stem,
                e.pattern,
                e.root_family,
                e.root_info AS entry_root_info,
                e.root_in_sandhi,
                e.base,
                e.derivative,
                e.phonetic,
                e.compound,
                e.antonym,
                e.synonym,
                e.variant,
                e.commentary,
                e.notes,
                e.cognate,
                e.link,
                e.non_ia,
                e.sanskrit AS entry_sanskrit,
                e.sanskrit_root AS entry_sanskrit_root,
                e.example_1,
                e.example_2
            """

            # Root Extras
            col_root_extras = """
                (r.root_group || ' ' || r.root_sign) AS root_basic_info, 
                CASE 
                    WHEN r.sanskrit_root IS NOT NULL AND r.sanskrit_root != '' 
                    THEN r.sanskrit_root || ' ' || r.sanskrit_root_class
                    ELSE ''
                END AS root_sanskrit_info
            """

            # Is Exact Logic
            col_is_exact = """
                (k.key = (SELECT term FROM input_param) 
                 AND k.key = CASE 
                    WHEN k.type = 1 THEN e.headword_clean
                    WHEN k.type = 0 THEN r.root_clean
                    ELSE k.key
                 END) AS is_exact
            """

            # --- CTE DEFINITIONS ---

            cte_params = "input_param AS (SELECT term, limit_exact, limit_prefix, limit_final FROM _search_params LIMIT 1)"

            cte_decon = """
            keys_decon AS (
                SELECT 
                    word AS key, 
                    0 AS target_id, 
                    -1 AS type,
                    0 AS rank, 
                    0 AS priority
                FROM deconstructions, input_param
                WHERE word = input_param.term
                LIMIT 1
            )
            """

            cte_exact = """
            keys_exact AS (
                SELECT key, target_id, type, rank, 1 AS priority
                FROM lookups_fts, input_param
                WHERE lookups_fts MATCH input_param.term
                LIMIT (SELECT limit_exact FROM input_param)
            )
            """

            cte_prefix = """
            keys_prefix AS (
                SELECT key, target_id, type, rank, 2 AS priority
                FROM lookups_fts, input_param
                WHERE length(input_param.term) >= 2
                  AND lookups_fts MATCH input_param.term || '*'
                LIMIT (SELECT limit_prefix FROM input_param)
            )
            """

            cte_all_keys = """
            all_keys AS (
                SELECT * FROM keys_decon
                UNION ALL
                SELECT * FROM keys_exact
                UNION ALL
                SELECT * FROM keys_prefix
            )
            """

            cte_unique_keys = """
            unique_keys AS (
                SELECT 
                    key, target_id, type, 
                    MIN(rank) as rank, 
                    MIN(priority) as priority
                FROM all_keys
                GROUP BY target_id, type
                ORDER BY priority ASC, length(key) ASC, rank 
                LIMIT (SELECT limit_final FROM input_param)
            )
            """

            # --- FINAL ASSEMBLY ---

            sql_view = f"""
            CREATE VIEW view_search_results AS
            WITH 
                {cte_params},
                {cte_decon},
                {cte_exact},
                {cte_prefix},
                {cte_all_keys},
                {cte_unique_keys}
            SELECT 
                k.key, k.target_id, k.type,
                {col_headword},
                {col_pos},
                {col_meaning},
                {col_origin},
                
                -- Entry Specifics
                {col_entry_info},
                
                -- Root Specifics
                {col_root_extras},
                
                {col_is_exact},
                l.inflection_map
            FROM unique_keys k
            LEFT JOIN entries e ON k.target_id = e.id AND k.type = 1
            LEFT JOIN roots r ON k.target_id = r.id AND k.type = 0
            LEFT JOIN deconstructions d ON k.key = d.word AND k.type = -1
            LEFT JOIN lookups l ON k.key = l.key AND k.target_id = l.target_id AND k.type = l.type
            ORDER BY k.priority ASC, is_exact DESC, length(k.key) ASC, k.rank;
            """

            self.cursor.execute("DROP VIEW IF EXISTS view_search_results")
            self.cursor.execute(sql_view)
            
        except Exception as e:
            logger.error(f"Failed to inject search procedures: {e}")