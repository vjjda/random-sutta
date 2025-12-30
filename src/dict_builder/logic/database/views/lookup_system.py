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
            
            # Meaning
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
            CREATE VIEW view_lookup_results AS
            WITH params AS (
                SELECT term FROM _lookup_params LIMIT 1
            ),
            -- 1. Get Keys from Deconstructions (Priority 0)
            keys_decon AS (
                SELECT 
                    word as key, 
                    0 as target_id, 
                    -1 as type,
                    0 as priority
                FROM deconstructions, params
                WHERE word = params.term
                LIMIT 1
            ),
            -- 2. Get Keys from Main Search (Priority 1)
            keys_main AS (
                SELECT 
                    key, target_id, type, 
                    1 as priority
                FROM lookups_fts, params
                WHERE lookups_fts MATCH params.term
                -- Explicitly filter Exact Match logic here on the small result set
                -- AND key = params.term
            ),
            -- 3. Union Keys Only (Lightweight)
            all_keys AS (
                SELECT * FROM keys_decon
                UNION ALL
                SELECT * FROM keys_main
            )
            -- 4. Hydrate Data (Join only what is needed)
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
                
                -- Headword Clean
                CASE 
                    WHEN k.type = 1 THEN e.headword_clean
                    WHEN k.type = 0 THEN r.root_clean
                    ELSE NULL
                END AS headword_clean,
                
                k.priority
            FROM all_keys k
            LEFT JOIN entries e ON k.target_id = e.id AND k.type = 1
            LEFT JOIN roots r ON k.target_id = r.id AND k.type = 0
            LEFT JOIN deconstructions d ON k.key = d.word AND k.type = -1
            LEFT JOIN grammar_notes gn ON k.key = gn.key
            ORDER BY 
                k.priority ASC, 
                (k.key = (SELECT term FROM params)) DESC,
                (CASE 
                    WHEN k.type = 1 THEN e.headword_clean = (SELECT term FROM params)
                    WHEN k.type = 0 THEN r.root_clean = (SELECT term FROM params)
                    ELSE 0 
                END) DESC,
                k.type DESC;
            """

            self.cursor.execute("DROP VIEW IF EXISTS view_lookup_results")
            self.cursor.execute(sql_view)
            
            logger.info("✅ view_lookup_results created successfully.")
            
        except Exception as e:
            logger.error(f"Failed to inject lookup system: {e}")
