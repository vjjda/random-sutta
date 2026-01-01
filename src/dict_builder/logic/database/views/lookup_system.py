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
            # --- COLUMN DEFINITIONS (Logic for SELECT) ---
            
            # Headword selection based on type
            col_headword = """
                CASE 
                    WHEN k.type = -1 THEN k.key 
                    WHEN k.type = 1 THEN e.headword
                    WHEN k.type = 0 THEN r.root
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
                    ELSE NULL 
                END AS meaning
            """

            # Meaning Origin (Lit meaning or Sanskrit root meaning)
            # Mapped to 'meaning_lit' column for Entry
            col_meaning_origin = """
                CASE 
                    WHEN k.type = 1 THEN e.meaning_lit 
                    WHEN k.type = 0 THEN r.sanskrit_root_meaning 
                    ELSE NULL 
                END AS meaning_origin
            """
            
            # Entry Info (Mapped from flattened columns)
            # Note: Select ALL flattened columns from Entries.
            # Roots will return NULL for these columns, which is fine.
            # We alias them clearly.
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

            # Root Info (Mapped from Roots table)
            # We can alias these to match entry columns if we want polymorphic access,
            # or keep them separate. Keeping separate avoids collision with Entry columns.
            col_root_info = """
                (r.root_group || ' ' || r.root_sign) AS root_basic_info, 
                CASE 
                    WHEN r.sanskrit_root IS NOT NULL AND r.sanskrit_root != '' 
                    THEN r.sanskrit_root || ' ' || r.sanskrit_root_class
                    ELSE ''
                END AS root_sanskrit_info
            """

            # Is Exact Logic
            col_is_exact = "(k.key = (SELECT term FROM params)) AS is_exact"

            # Contains Whole Word Logic
            term_sel = "(SELECT term FROM params)"
            col_has_word = f"""
                (
                    k.key = {term_sel} OR
                    k.key LIKE {term_sel} || ' %' OR
                    k.key LIKE '% ' || {term_sel} OR
                    k.key LIKE '% ' || {term_sel} || ' %'
                ) AS has_word
            """

            # --- CTE DEFINITIONS ---

            cte_params = "params AS (SELECT term FROM _lookup_params LIMIT 1)"

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

            cte_all_keys = """
            all_keys AS (
                SELECT * FROM keys_decon
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
                {cte_main},
                {cte_all_keys}
            SELECT 
                k.key, k.target_id, k.type,
                {col_headword},
                {col_headword_clean},
                {col_pos},
                {col_meaning},
                {col_meaning_origin},
                
                -- Entry Specifics
                {col_entry_info},
                
                -- Root Specifics
                {col_root_info},
                
                -- Meta
                k.priority,
                {col_is_exact},
                {col_has_word},
                l.inflection_map
            FROM all_keys k
            LEFT JOIN entries e ON k.target_id = e.id AND k.type = 1
            LEFT JOIN roots r ON k.target_id = r.id AND k.type = 0
            LEFT JOIN deconstructions d ON k.key = d.word AND k.type = -1
            LEFT JOIN lookups l ON k.key = l.key AND k.target_id = l.target_id AND k.type = l.type
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