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

            suffix = "json"
            if self.config.is_tiny_mode:
                grammar_field = "NULL"
                example_field = "NULL"
            else:
                grammar_field = f"e.grammar_{suffix}"
                example_field = f"e.example_{suffix}"

            # 1. Unified Columns (Entry + Root + Decon)
            
            # POS
            pos_field = "CASE WHEN k.type = 1 THEN e.pos WHEN k.type = 0 THEN 'root' ELSE NULL END AS pos"
            
            # Meaning (Entry, Root, Decon Components)
            # For Decon (Type -1), we put components into 'meaning' field for now, or keep it separate?
            # Let's follow Grand View logic: Entry/Root only. Decon components are usually mapped to 'definition' in legacy.
            # Here: meaning -> e.meaning / r.root_meaning / d.components
            meaning_field = """
                CASE 
                    WHEN k.type = 1 THEN e.meaning 
                    WHEN k.type = 0 THEN r.root_meaning 
                    WHEN k.type = -1 THEN d.components
                    ELSE NULL 
                END AS meaning
            """
            
            # Meaning Origin
            origin_field = "CASE WHEN k.type = 1 THEN e.meaning_lit WHEN k.type = 0 THEN r.sanskrit_root_meaning ELSE NULL END AS meaning_origin"
            
            # Entry Cols
            entry_cols = "e.plus_case, e.construction, e.degree"

            # Root Extras
            root_cols = """
                (r.root_group || ' ' || r.root_sign) AS root_info, 
                CASE 
                    WHEN r.sanskrit_root IS NOT NULL AND r.sanskrit_root != '' 
                    THEN r.sanskrit_root || ' ' || r.sanskrit_root_class
                    ELSE ''
                END AS sanskrit_info
            """

            sql_view = f"""
            CREATE VIEW view_search_results AS
            WITH input_param AS (
                SELECT term, limit_exact, limit_prefix, limit_final FROM _search_params LIMIT 1
            ),
            -- 1. Keys from Deconstruction (Priority 0)
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
            ),
            -- 2. Keys from Exact Match FTS (Priority 1)
            keys_exact AS (
                SELECT key, target_id, type, rank, 1 AS priority
                FROM lookups_fts, input_param
                WHERE lookups_fts MATCH input_param.term
                LIMIT (SELECT limit_exact FROM input_param)
            ),
            -- 3. Keys from Prefix Match FTS (Priority 2)
            keys_prefix AS (
                SELECT key, target_id, type, rank, 2 AS priority
                FROM lookups_fts, input_param
                WHERE length(input_param.term) >= 2
                  AND lookups_fts MATCH input_param.term || '*'
                LIMIT (SELECT limit_prefix FROM input_param)
            ),
            -- 4. Combine Keys
            all_keys AS (
                SELECT * FROM keys_decon
                UNION ALL
                SELECT * FROM keys_exact
                UNION ALL
                SELECT * FROM keys_prefix
            ),
            -- 5. Deduplicate Keys (Best priority per target)
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
            -- 6. Hydrate Data (Join Last)
            SELECT 
                k.key, k.target_id, k.type,
                -- Headword Logic
                CASE 
                    WHEN k.type = -1 THEN k.key 
                    WHEN k.type = 1 THEN e.headword
                    WHEN k.type = 0 THEN r.root
                    ELSE k.key
                END AS headword,
                
                -- Unified Content
                {pos_field},
                {entry_cols}, -- plus_case, construction, degree
                {meaning_field},
                {origin_field}, -- meaning_origin
                
                {grammar_field} AS grammar,
                {example_field} AS example,
                gn.grammar_pack AS gn_grammar,
                
                {root_cols},
                
                -- Is Exact Logic
                (k.key = (SELECT term FROM input_param) 
                 AND k.key = CASE 
                    WHEN k.type = 1 THEN e.headword_clean
                    WHEN k.type = 0 THEN r.root_clean
                    ELSE k.key
                 END) AS is_exact
            FROM unique_keys k
            LEFT JOIN entries e ON k.target_id = e.id AND k.type = 1
            LEFT JOIN roots r ON k.target_id = r.id AND k.type = 0
            LEFT JOIN deconstructions d ON k.key = d.word AND k.type = -1
            LEFT JOIN grammar_notes gn ON k.key = gn.key
            ORDER BY k.priority ASC, is_exact DESC, length(k.key) ASC, k.rank;
            """

            self.cursor.execute("DROP VIEW IF EXISTS view_search_results")
            self.cursor.execute(sql_view)
            
        except Exception as e:
            logger.error(f"Failed to inject search procedures: {e}")
