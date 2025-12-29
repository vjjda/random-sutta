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
        
        # 1. Definition (Logic Entry)
        definition_field = (
            f"CASE "
            f"WHEN l.type = 1 THEN e.definition_{suffix} "
            f"ELSE NULL END AS definition"
        )
        
        # 2. Headword Logic
        headword_field = "CASE WHEN l.type = 1 THEN e.headword WHEN l.type = 0 THEN r.root ELSE NULL END AS headword"
        clean_headword_field = "CASE WHEN l.type = 1 THEN e.headword_clean WHEN l.type = 0 THEN r.root_clean ELSE NULL END AS headword_clean"
        
        # 3. Grammar & Example (Entry)
        if self.config.is_tiny_mode:
            grammar_field = "NULL AS grammar"
            example_field = "NULL AS example"
        else:
            grammar_field = f"e.grammar_{suffix} AS grammar"
            example_field = f"e.example_{suffix} AS example"

        # 4. Root Columns
        root_cols = """
            r.root_meaning, 
            (r.root_group || ' ' || r.root_sign) AS root_info, 
            CASE 
                WHEN r.sanskrit_root IS NOT NULL AND r.sanskrit_root != '' 
                THEN r.sanskrit_root || ' ' || r.sanskrit_root_class || ' (' || r.sanskrit_root_meaning || ')'
                ELSE ''
            END AS sanskrit_info,
            r.root_clean
        """

        # 5. Extra Fields
        grammar_note_field = "gn.grammar_pack AS gn_grammar"

        sql = f"""
            CREATE VIEW IF NOT EXISTS view_grand_lookups AS
            SELECT 
                -- Core Identity
                l.key AS key, 
                l.target_id, 
                l.type AS type,
                tt.table_name,
                
                -- Main Content
                {headword_field}, 
                {clean_headword_field},
                {definition_field},
                {grammar_field}, 
                {example_field},
                {grammar_note_field},
                
                -- Root Details
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
