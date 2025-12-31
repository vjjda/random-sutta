# Path: src/dict_builder/logic/database/views/lookup_system.py
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
            suffix = "json"
            if self.config.is_tiny_mode:
                grammar_field = "NULL"
                example_field = "NULL"
            else:
                grammar_field = f"e.grammar_{suffix}"
                example_field = f"e.example_{suffix}"

            # --- COLUMN DEFINITIONS (Logic for SELECT) ---
            
            # Headword selection based on type
            col_headword = """
                CASE 
                    WHEN k.type = -1 THEN k.key 
                    WHEN k.type = 1 THEN e.headword
                    WHEN k.type = 0 THEN r.root
                    WHEN k.type = -2 THEN k.key
                    ELSE k.key
                END AS headword
            """

            # Headword Clean (for sorting/matching)
            col_headword_clean = """
                CASE 
                    WHEN k.type = 1 THEN e.headword_clean
                    WHEN k.type = 0 THEN r.root_clean
                    ELSE NULL
                END AS headword_clean
            """

            # Part of Speech
            col_pos = "CASE WHEN k.type = 1 THEN e.pos WHEN k.type = 0 THEN 'root' ELSE NULL END AS pos"

            # Meaning content
            col_meaning = """
                CASE 
                    WHEN k.type = 1 THEN e.meaning 
                    WHEN k.type = 0 THEN r.root_meaning 
                    WHEN k.type = -1 THEN d.components
                    WHEN k.type = -2 THEN gn.grammar_pack
                    ELSE NULL 
                END AS meaning
            """

            # Meaning Origin (Lit meaning or Sanskrit root)
            col_origin = "CASE WHEN k.type = 1 THEN e.meaning_lit WHEN k.type = 0 THEN r.sanskrit_root_meaning ELSE NULL END AS meaning_origin"

            # Entry specific columns
            col_entry_extras = "e.plus_case, e.construction, e.degree"

            # Root specific columns
            col_root_extras = """
                (r.root_group || ' ' || r.root_sign) AS root_info, 
                CASE 
                    WHEN r.sanskrit_root IS NOT NULL AND r.sanskrit_root != '' 
                    THEN r.sanskrit_root || ' ' || r.sanskrit_root_class
                    ELSE ''
                END AS sanskrit_info
            """

            # Contains Whole Word Logic
            # Prioritize keys containing the exact search term as a distinct word.
            # Covers: 'na hi' (start), 'hi na' (end), 'x na y' (middle).
            # Excludes: 'ṅa' (diacritic mismatch), 'banana' (substring mismatch).
            term_sel = "(SELECT term FROM params)"
            col_has_word = f"""
                (
                    k.key = {term_sel} OR
                    k.key LIKE {term_sel} || ' %' OR
                    k.key LIKE '% ' || {term_sel} OR
                    k.key LIKE '% ' || {term_sel} || ' %'
                ) AS has_word
            """

            # --- CTE DEFINITIONS (Common Table Expressions) ---

            # 0. Params (Input)
            cte_params = "params AS (SELECT term FROM _lookup_params LIMIT 1)"

            # 1. Deconstructions (Priority 0)
            cte_decon = """
            keys_decon AS (
                SELECT 
                    word as key, 
                    0 as target_id, 
                    -1 as type,
                    0 as priority,
                    0 as rank
                FROM deconstructions, params
                WHERE word = params.term
                LIMIT 1
            )
            """

            # 2. Grammar Notes (Priority 0)
            cte_grammar = """
            keys_grammar AS (
                SELECT 
                    key, 
                    0 as target_id, 
                    -2 as type,
                    0 as priority,
                    0 as rank
                FROM grammar_notes, params
                WHERE key = params.term
                LIMIT 1
            )
            """

            # 3. Main Search (Priority 1) - Uses FTS
            cte_main = """
            keys_main AS (
                SELECT 
                    key, target_id, type, 
                    1 as priority,
                    rank
                FROM lookups_fts, params
                WHERE lookups_fts MATCH params.term
            )
            """

            # 4. Union All (Combine Keys)
            cte_all_keys = """
            all_keys AS (
                SELECT * FROM keys_decon
                UNION ALL
                SELECT * FROM keys_grammar
                UNION ALL
                SELECT * FROM keys_main
            )
            """

            # --- FINAL ASSEMBLY ---
            
            sql_view = f"""
            CREATE VIEW view_lookup_results AS
            WITH 
                {cte_params},
                {cte_decon},
                {cte_grammar},
                {cte_main},
                {cte_all_keys}
            SELECT 
                k.key, k.target_id, k.type,
                {col_headword},
                {col_pos},
                {col_entry_extras},
                {col_meaning},
                {col_origin},
                {grammar_field} AS grammar, 
                {example_field} AS example,
                {col_root_extras},
                {col_headword_clean},
                k.priority,
                (k.key = (SELECT term FROM params)) AS is_exact,
                {col_has_word}
            FROM all_keys k
            LEFT JOIN entries e ON k.target_id = e.id AND k.type = 1
            LEFT JOIN roots r ON k.target_id = r.id AND k.type = 0
            LEFT JOIN deconstructions d ON k.key = d.word AND k.type = -1
            LEFT JOIN grammar_notes gn ON k.key = gn.key AND k.type = -2
            ORDER BY 
                k.priority ASC, 
                is_exact DESC,
                has_word DESC,
                k.rank ASC;
            """

            self.cursor.execute("DROP VIEW IF EXISTS view_lookup_results")
            self.cursor.execute(sql_view)
            
            logger.info("✅ view_lookup_results created successfully.")
            
        except Exception as e:
            logger.error(f"Failed to inject lookup system: {e}")
