import logging
from sqlite3 import Cursor
from ....builder_config import BuilderConfig

logger = logging.getLogger("dict_builder.views.grand")

class GrandViewBuilder:
    def __init__(self, cursor: Cursor, config: BuilderConfig):
        self.cursor = cursor
        self.config = config

    def create(self) -> None:
        """Tạo View tổng hợp (Content Layer) dùng cho debug hoặc overview."""
        logger.info("[cyan]Creating 'view_grand_lookups' view...[/cyan]")
        
        suffix = "json"
        
        # [REFACTOR] Unified Columns Logic (Entry + Root)
        
        # 1. POS
        pos_field = "CASE WHEN l.type = 1 THEN e.pos WHEN l.type = 0 THEN 'root' ELSE NULL END AS pos"
        
        # 2. Meaning (Entry Meaning or Root Meaning)
        meaning_field = "CASE WHEN l.type = 1 THEN e.meaning WHEN l.type = 0 THEN r.root_meaning ELSE NULL END AS meaning"
        
        # 3. Meaning Origin (Lit Meaning or Sanskrit Meaning)
        origin_field = "CASE WHEN l.type = 1 THEN e.meaning_lit WHEN l.type = 0 THEN r.sanskrit_root_meaning ELSE NULL END AS meaning_origin"
        
        # 4. Entry-Specific Columns (NULL for Roots)
        entry_cols = "e.plus_case, e.construction, e.degree"

        # 5. Headword Logic
        headword_field = "CASE WHEN l.type = 1 THEN e.headword WHEN l.type = 0 THEN r.root ELSE NULL END AS headword"
        clean_headword_field = "CASE WHEN l.type = 1 THEN e.headword_clean WHEN l.type = 0 THEN r.root_clean ELSE NULL END AS headword_clean"
        
        # 6. Grammar & Example (Entry)
        if self.config.is_tiny_mode:
            grammar_field = "NULL AS grammar"
            example_field = "NULL AS example"
        else:
            grammar_field = f"e.grammar_{suffix} AS grammar"
            example_field = f"e.example_{suffix} AS example"

        # 7. Root Details (Extra info not covered by unified columns)
        # We kept root_meaning in 'meaning', sanskrit_meaning in 'meaning_origin'.
        # Remaining: group, sign, sanskrit_root, class
        root_cols = """
            (r.root_group || ' ' || r.root_sign) AS root_info, 
            CASE 
                WHEN r.sanskrit_root IS NOT NULL AND r.sanskrit_root != '' 
                THEN r.sanskrit_root || ' ' || r.sanskrit_root_class
                ELSE ''
            END AS sanskrit_info
        """

        # 8. Extra Fields
        grammar_note_field = "gn.grammar_pack AS gn_grammar"

        sql = f"""
            CREATE VIEW IF NOT EXISTS view_grand_lookups AS
            SELECT 
                -- Core Identity
                l.key AS key, 
                l.target_id, 
                l.type AS type,
                tt.table_name,
                
                -- Main Content (Unified)
                {headword_field}, 
                {clean_headword_field},
                {pos_field},
                {entry_cols}, -- plus_case, construction, degree
                {meaning_field},
                {origin_field}, -- meaning_lit / sk_meaning
                
                -- Details
                {grammar_field}, 
                {example_field},
                {grammar_note_field},
                
                -- Root Extras
                {root_cols}
                
            FROM lookups l
            LEFT JOIN entries e ON l.target_id = e.id AND l.type = 1
            LEFT JOIN roots r ON l.target_id = r.id AND l.type = 0
            LEFT JOIN grammar_notes gn ON l.key = gn.key
            LEFT JOIN table_types tt ON l.type = tt.type;
        """

        
        try:
            self.cursor.execute("DROP VIEW IF EXISTS grand_lookups;") 
            self.cursor.execute("DROP VIEW IF EXISTS view_grand_lookups;")
            self.cursor.execute(sql)
        except Exception as e:
            logger.error(f"Failed to create grand view: {e}")
