# Path: src/dict_builder/logic/database/schema_manager.py
import logging
from sqlite3 import Cursor
from ...builder_config import BuilderConfig
from src.dict_builder.tools.json_key_map import get_key_map_list

logger = logging.getLogger("dict_builder.schema")

class SchemaManager:
    def __init__(self, cursor: Cursor, config: BuilderConfig):
        self.cursor = cursor
        self.config = config

    def create_tables(self) -> None:
        """Tạo cấu trúc bảng và index cơ bản."""
        self._create_core_tables()
        self._create_content_tables()
        self._create_fts_and_triggers()
        self._populate_static_data()
        self._insert_metadata()

    def _create_core_tables(self):
        self.cursor.execute("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT);")
        self.cursor.execute("CREATE TABLE IF NOT EXISTS deconstructions (word TEXT PRIMARY KEY, components TEXT);")
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS lookups (
                key TEXT NOT NULL, 
                target_id INTEGER NOT NULL, 
                type INTEGER NOT NULL, 
                inflection_map TEXT, 
                PRIMARY KEY (key, type, target_id)
            );
        """)
        self.cursor.execute("CREATE TABLE IF NOT EXISTS json_keys (abbr_key TEXT PRIMARY KEY, full_key TEXT);")
        self.cursor.execute("CREATE TABLE IF NOT EXISTS table_types (type INTEGER PRIMARY KEY, table_name TEXT);")
        self.cursor.execute("CREATE TABLE IF NOT EXISTS pack_schemas (table_name TEXT, column_name TEXT, schema TEXT, PRIMARY KEY (table_name, column_name));")

    def _create_content_tables(self):
        # [CLEANUP] Luôn dùng suffix 'json'
        suffix = "json"
        
        # Entries Table [REFACTORED: FLATTENED COLUMNS]
        # REVISED Order
        cols = """
            id INTEGER PRIMARY KEY, 
            headword TEXT NOT NULL, 
            headword_clean TEXT NOT NULL,
            pos TEXT,
            grammar TEXT,
            meaning TEXT,
            meaning_lit TEXT,
            construction TEXT,
            degree TEXT,
            plus_case TEXT,
            stem TEXT,
            pattern TEXT,
            root_family TEXT,
            root_info TEXT,
            root_in_sandhi TEXT,
            base TEXT,
            derivative TEXT,
            phonetic TEXT,
            compound TEXT,
            antonym TEXT,
            synonym TEXT,
            variant TEXT,
            commentary TEXT,
            notes TEXT,
            cognate TEXT,
            link TEXT,
            non_ia TEXT,
            sanskrit TEXT,
            sanskrit_root TEXT,
            example_1 TEXT,
            example_2 TEXT
        """
        
        # Tiny mode: Drop optional columns if needed (but SQLite handles NULL efficiently)
        # For simplicity, we use the same schema but insert NULLs in Tiny mode
        self.cursor.execute(f"CREATE TABLE IF NOT EXISTS entries ({cols});")
            
        # Roots Table
        # [REFACTOR] Split definition_json into physical columns
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS roots (
                id INTEGER PRIMARY KEY, 
                root TEXT NOT NULL, 
                root_clean TEXT NOT NULL,
                root_meaning TEXT,
                root_group INTEGER,
                root_sign TEXT,
                sanskrit_root TEXT,
                sanskrit_root_class TEXT,
                sanskrit_root_meaning TEXT
            );
        """)

    def _create_fts_and_triggers(self):
        # [OPTIMIZATION] idx_lookups_key is redundant due to Composite PK on lookups(key, type, target_id)
        self.cursor.execute("CREATE VIRTUAL TABLE IF NOT EXISTS lookups_fts USING fts5(key, target_id UNINDEXED, type UNINDEXED, tokenize='unicode61 remove_diacritics 2');")
        self.create_lookup_trigger()

    def create_lookup_trigger(self):
        self.cursor.execute("DROP TRIGGER IF EXISTS lookups_ai")
        self.cursor.execute("""
            CREATE TRIGGER lookups_ai AFTER INSERT ON lookups BEGIN
                INSERT INTO lookups_fts(key, target_id, type) VALUES (new.key, new.target_id, new.type);
            END;
        """)

    def _insert_metadata(self):
        meta = [
            ("version", "1.0"),
            ("mode", self.config.mode),
            ("format", "json"), # [CLEANUP] Always JSON
            ("compression", "zlib" if self.config.USE_COMPRESSION else "none")
        ]
        self.cursor.executemany("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)", meta)

    def _populate_static_data(self):
        key_list = get_key_map_list()
        swapped_list = sorted([(abbr, full) for full, abbr in key_list], key=lambda x: x[0])
        self.cursor.executemany("INSERT OR IGNORE INTO json_keys (abbr_key, full_key) VALUES (?, ?)", swapped_list)

        # [UPDATE] New Type Mappings
        # 0=roots, 1=entries, -1=deconstructions
        types = [
            (0, "roots"), 
            (1, "entries"),
            (-1, "deconstructions")
        ]
        self.cursor.executemany("INSERT OR IGNORE INTO table_types (type, table_name) VALUES (?, ?)", types)
        
        logger.info("Schema initialized.")