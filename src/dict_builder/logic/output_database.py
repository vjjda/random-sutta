# Path: src/dict_builder/logic/output_database.py
import sqlite3
import logging
from typing import List, Tuple

from ..builder_config import BuilderConfig
from src.dict_builder.tools.json_key_map import get_key_map_list
from src.dict_builder.tools.pali_sort_key import pali_sort_key

logger = logging.getLogger("dict_builder")

class OutputDatabase:
    def __init__(self, config: BuilderConfig):
        self.config = config
        self.conn: sqlite3.Connection | None = None
        self.cursor: sqlite3.Cursor | None = None

    def setup(self) -> None:
        if not self.config.OUTPUT_DIR.exists():
            self.config.OUTPUT_DIR.mkdir(parents=True)
        if self.config.output_path.exists():
            self.config.output_path.unlink()
        
        self.conn = sqlite3.connect(self.config.output_path)
        self.cursor = self.conn.cursor()
        
        self.cursor.execute("PRAGMA synchronous = OFF")
        self.cursor.execute("PRAGMA journal_mode = MEMORY")
        
        self._create_tables()
        
        # Metadata
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("version", "1.0"))
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("mode", self.config.mode))
        
        fmt = "html" if self.config.html_mode else "json"
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("format", fmt))
        
        comp_status = "zlib" if self.config.USE_COMPRESSION else "none"
        self.cursor.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("compression", comp_status))
        
        # Populate Static Data
        self.populate_json_keys()
        self.populate_table_types()
        self.populate_pack_schemas()
        
        self.conn.commit()

    def _create_tables(self) -> None:
        self.cursor.execute("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT);")
        
        # [RENAMED] split_string -> components
        self.cursor.execute("CREATE TABLE IF NOT EXISTS deconstructions (id INTEGER PRIMARY KEY, word TEXT NOT NULL, components TEXT);")
        
        self.cursor.execute("CREATE TABLE IF NOT EXISTS lookups (key TEXT NOT NULL, target_id INTEGER NOT NULL, type INTEGER NOT NULL);")
        
        self.cursor.execute("CREATE TABLE IF NOT EXISTS json_keys (abbr_key TEXT PRIMARY KEY, full_key TEXT);")
        
        # [NEW] Table Types Mapping
        self.cursor.execute("CREATE TABLE IF NOT EXISTS table_types (type INTEGER PRIMARY KEY, table_name TEXT);")

        # [NEW] Pack Schemas (Documentation for opaque packed columns)
        self.cursor.execute("CREATE TABLE IF NOT EXISTS pack_schemas (table_name TEXT, column_name TEXT, schema TEXT, PRIMARY KEY (table_name, column_name));")

        suffix = "html" if self.config.html_mode else "json"
        
        if self.config.is_tiny_mode:
            sql = "CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY, headword TEXT NOT NULL, headword_clean TEXT NOT NULL, definition_" + suffix + " TEXT);"
            self.cursor.execute(sql)
        else:
            sql = "CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY, headword TEXT NOT NULL, headword_clean TEXT NOT NULL, definition_" + suffix + " TEXT, grammar_" + suffix + " TEXT, example_" + suffix + " TEXT);"
            self.cursor.execute(sql)
            
        sql_roots = "CREATE TABLE IF NOT EXISTS roots (id INTEGER PRIMARY KEY, root TEXT NOT NULL, root_clean TEXT NOT NULL, definition_" + suffix + " TEXT);"
        self.cursor.execute(sql_roots)
        
        self.cursor.execute("CREATE INDEX IF NOT EXISTS idx_lookups_key ON lookups(key);")
        
        # FTS5 for Full Text Search
        self.cursor.execute("CREATE VIRTUAL TABLE IF NOT EXISTS lookups_fts USING fts5(key, target_id UNINDEXED, type UNINDEXED, tokenize='unicode61 remove_diacritics 2');")
        
        # Trigger creation
        self._create_lookup_trigger()
        
        if self.config.html_mode:
            self.cursor.execute("CREATE TABLE IF NOT EXISTS grammar_notes (key TEXT PRIMARY KEY, grammar_html TEXT);")
        else:
            # [OPTIMIZED] Columnar storage for Grammar Notes (Grouped JSON)
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS grammar_notes (
                    key TEXT PRIMARY KEY,
                    grammar_pack TEXT
                );
            """)

    def _create_lookup_trigger(self) -> None:
        """Helper to create the trigger."""
        self.cursor.execute("DROP TRIGGER IF EXISTS lookups_ai")
        self.cursor.execute("""
            CREATE TRIGGER lookups_ai AFTER INSERT ON lookups BEGIN
                INSERT INTO lookups_fts(key, target_id, type) VALUES (new.key, new.target_id, new.type);
            END;
        """)

    def populate_json_keys(self) -> None:
        key_list = get_key_map_list()
        swapped_list = sorted([(abbr, full) for full, abbr in key_list], key=lambda x: x[0])
        self.cursor.executemany("INSERT INTO json_keys (abbr_key, full_key) VALUES (?, ?)", swapped_list)

    def populate_table_types(self) -> None:
        """Populate table_types with static mapping data."""
        data = [
            (0, "deconstructions"),
            (1, "entries"),
            (2, "roots")
        ]
        try:
            self.cursor.executemany("INSERT OR IGNORE INTO table_types (type, table_name) VALUES (?, ?)", data)
            logger.info("[cyan]Populated 'table_types' mapping table.[/cyan]")
        except Exception as e:
            logger.error(f"[red]Failed to populate table_types: {e}[/red]")

    def populate_pack_schemas(self) -> None:
        """Populate the schema descriptions for packed columns."""
        grammar_schema = '[["headword", "pos", [["g1", "g2", "g3"]]]]'
        
        data = [
            ("grammar_notes", "grammar_pack", grammar_schema)
        ]
        try:
            self.cursor.executemany("INSERT OR IGNORE INTO pack_schemas (table_name, column_name, schema) VALUES (?, ?, ?)", data)
            logger.info("[cyan]Populated 'pack_schemas'.[/cyan]")
        except Exception as e:
            logger.error(f"[red]Failed to populate pack_schemas: {e}[/red]")

    def insert_batch(self, entries: List[Tuple], lookups: List[Tuple]) -> None:
        if entries:
            suffix = "html" if self.config.html_mode else "json"
            try:
                if self.config.is_tiny_mode:
                    sql = "INSERT INTO entries (id, headword, headword_clean, definition_" + suffix + ") VALUES (?, ?, ?, ?)"
                else:
                    sql = "INSERT INTO entries (id, headword, headword_clean, definition_" + suffix + ", grammar_" + suffix + ", example_" + suffix + ") VALUES (?, ?, ?, ?, ?, ?)"
                self.cursor.executemany(sql, entries)
            except Exception as e:
                logger.error(f"Entries insert failed. SQL: {sql}")
                raise e

        if lookups:
            try:
                sql_lookups = "INSERT INTO lookups (key, target_id, type) VALUES (?, ?, ?)"
                self.cursor.executemany(sql_lookups, lookups)
            except Exception as e:
                logger.error(f"Lookups insert failed. SQL: {sql_lookups}")
                raise e
        self.conn.commit()

    def insert_deconstructions(self, deconstructions: List[Tuple], lookups: List[Tuple]) -> None:
        if deconstructions:
            # [RENAMED] split_string -> components
            self.cursor.executemany("INSERT INTO deconstructions (id, word, components) VALUES (?, ?, ?)", deconstructions)
        if lookups:
            self.cursor.executemany("INSERT INTO lookups (key, target_id, type) VALUES (?, ?, ?)", lookups)
        self.conn.commit()

    def insert_roots(self, roots: List[Tuple], lookups: List[Tuple]) -> None:
        if roots:
            suffix = "html" if self.config.html_mode else "json"
            sql = "INSERT INTO roots (id, root, root_clean, definition_" + suffix + ") VALUES (?, ?, ?, ?)"
            self.cursor.executemany(sql, roots)
        
        if lookups:
            self.cursor.executemany("INSERT INTO lookups (key, target_id, type) VALUES (?, ?, ?)", lookups)
        self.conn.commit()

    def insert_grammar_notes(self, grammar_batch: List[Tuple]) -> None:
        if grammar_batch:
            if self.config.html_mode:
                self.cursor.executemany("INSERT INTO grammar_notes (key, grammar_html) VALUES (?, ?)", grammar_batch)
            else:
                self.cursor.executemany("INSERT INTO grammar_notes (key, grammar_pack) VALUES (?, ?)", grammar_batch)
        self.conn.commit()

    def create_grand_view(self) -> None:
        """
        Tạo View tổng hợp (Content Layer).
        Đã nâng cấp để expose đủ cột cho Search View.
        """
        logger.info("[cyan]Creating 'grand_lookups' view (Unified Definition)...[/cyan]")
        
        suffix = "html" if self.config.html_mode else "json"
        
        # 1. Grammar Note Field
        if self.config.html_mode:
            grammar_note_field = "gn.grammar_html"
        else:
            grammar_note_field = "gn.grammar_pack"

        # 2. Unified Definition (Logic cũ vẫn giữ để tương thích backward)
        definition_field = (
            f"CASE "
            f"WHEN l.type = 0 THEN d.components "
            f"WHEN l.type = 1 THEN e.definition_{suffix} "
            f"WHEN l.type = 2 THEN r.definition_{suffix} "
            f"ELSE NULL END AS definition"
        )
        
        # 3. Headword Logic
        headword_field = (
            "CASE "
            "WHEN l.type = 1 THEN e.headword "
            "WHEN l.type = 2 THEN r.root "
            "ELSE NULL END AS headword"
        )

        # 4. Clean Key Logic (Dùng cho is_exact check)
        clean_headword_field = (
            "CASE "
            "WHEN l.type = 1 THEN e.headword_clean "
            "WHEN l.type = 0 THEN d.word "
            "WHEN l.type = 2 THEN r.root_clean "
            "ELSE NULL END AS headword_clean"
        )

        # 5. Các cột Raw (để Search View dùng lại)
        # Chỉ lấy cột grammar/example nếu bảng entries có cột đó (trừ tiny mode)
        extra_cols = ""
        if not self.config.is_tiny_mode:
            extra_cols = (
                f", e.grammar_{suffix} AS raw_grammar"
                f", e.example_{suffix} AS raw_example"
            )

        sql = f"""
            CREATE VIEW IF NOT EXISTS grand_lookups AS
            SELECT 
                l.key AS lookup_key, 
                l.target_id, 
                l.type AS lookup_type,
                {headword_field},
                {clean_headword_field},
                {definition_field},
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
            self.conn.commit()
            logger.info("[green]View 'grand_lookups' created successfully.[/green]")
        except Exception as e:
            logger.critical(f"[bold red]❌ Failed to create grand view: {e}")

    def _sort_lookups_table_python_side(self) -> None:
        """
        Sắp xếp bảng Lookups theo Pali Sort Key (Python Side).
        """
        logger.info("[yellow]Re-sorting 'lookups' table (Python Pali Sort)...[/yellow]")
        
        try:
            # 1. Fetch ALL lookups
            self.cursor.execute("SELECT key, target_id, type FROM lookups")
            rows = self.cursor.fetchall()
            
            # 2. Sort using Python Pali Key
            # [OPTIMIZED] Sort by LENGTH first, then Alphabet.
            rows.sort(key=lambda x: (len(x[0]), pali_sort_key(x[0])))
            
            # 3. Drop Trigger
            self.cursor.execute("DROP TRIGGER IF EXISTS lookups_ai")
            
            # 4. Truncate tables
            self.cursor.execute("DELETE FROM lookups")
            self.cursor.execute("DELETE FROM lookups_fts")
            
            # 5. Re-insert
            logger.info(f"   Inserting {len(rows)} sorted rows into 'lookups'...")
            self.cursor.executemany("INSERT INTO lookups (key, target_id, type) VALUES (?, ?, ?)", rows)
            
            # 6. Populate FTS
            logger.info("   Populating 'lookups_fts'...")
            self.cursor.execute("INSERT INTO lookups_fts (key, target_id, type) SELECT key, target_id, type FROM lookups")
            
            # 7. Re-create Trigger
            self._create_lookup_trigger()
            
            self.conn.commit()
            logger.info(f"[green]Lookups & FTS tables sorted and rebuilt successfully.[/green]")
            
        except Exception as e:
            logger.error(f"[red]Failed to sort lookups table: {e}")

    def create_search_procedures(self) -> None:
        """
        Tạo cơ chế 'Stored Procedure' giả lập bằng Parametric View.
        Cho phép tái sử dụng query phức tạp 'effortlessly'.
        """
        logger.info("[cyan]Injecting Search Procedures (Table + View)...[/cyan]")
        
        try:
            # 1. Tạo bảng tham số (_search_params)
            self.cursor.execute("DROP TABLE IF EXISTS _search_params")
            self.cursor.execute("CREATE TABLE _search_params (term TEXT)")
            self.cursor.execute("INSERT INTO _search_params (term) VALUES ('')")

            # 2. Tạo View Logic
            sql_view = """
            CREATE VIEW view_search_results AS
            WITH input_param AS (
                SELECT term FROM _search_params LIMIT 1
            ),
            ft_results AS (
                SELECT * FROM (
                    -- Priority 1: Exact Match
                    SELECT key, target_id, type, rank, 1 AS priority
                    FROM lookups_fts
                    WHERE lookups_fts MATCH (SELECT term FROM input_param)
                    LIMIT 20
                )
                UNION ALL
                SELECT * FROM (
                    -- Priority 2: Prefix Match
                    SELECT key, target_id, type, rank, 2 AS priority
                    FROM lookups_fts
                    WHERE lookups_fts MATCH (SELECT term FROM input_param) || '*'
                    LIMIT 100
                )
            ),
            raw_matches AS (
                SELECT key, target_id, type, rank, priority FROM ft_results
            )
            SELECT 
                matches.key, 
                matches.target_id, 
                matches.type,
                gl.headword,
                gl.definition,
                gl.raw_grammar AS grammar,
                gl.raw_example AS example,
                gl.gn_grammar,
                (
                    matches.key = (SELECT term FROM input_param) 
                    AND 
                    matches.key = COALESCE(gl.headword_clean, matches.key)
                ) AS is_exact
            FROM raw_matches matches
            JOIN grand_lookups gl 
                ON matches.target_id = gl.target_id 
                AND matches.type = gl.lookup_type
            GROUP BY matches.type, matches.target_id
            ORDER BY 
                matches.priority ASC, 
                is_exact DESC, 
                length(matches.key) ASC, 
                matches.rank
            LIMIT 20;
            """

            self.cursor.execute("DROP VIEW IF EXISTS view_search_results")
            self.cursor.execute(sql_view)
            self.conn.commit()
            logger.info("[green]Search procedures injected successfully.[/green]")
            
        except Exception as e:
            logger.error(f"[red]Failed to inject search procedures: {e}[/red]")

    def close(self) -> None:
        if self.conn:
            self._sort_lookups_table_python_side()
            
            # [UPDATED] Gọi 2 hàm tạo View
            self.create_grand_view() 
            self.create_search_procedures()
            
            logger.info("[green]Indexing & Optimizing (VACUUM)...[/green]")
            self.conn.execute("VACUUM")
            self.conn.close()