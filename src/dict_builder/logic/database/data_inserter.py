# Path: src/dict_builder/logic/database/data_inserter.py
import logging
from sqlite3 import Cursor, Connection
from typing import List, Tuple
from ...builder_config import BuilderConfig

logger = logging.getLogger("dict_builder.inserter")

class DataInserter:
    def __init__(self, conn: Connection, cursor: Cursor, config: BuilderConfig):
        self.conn = conn
        self.cursor = cursor
        self.config = config
        # [CLEANUP] Always use json suffix
        self.suffix = "json"

    def insert_entries_batch(self, entries: List[Tuple], lookups: List[Tuple]) -> None:
        if entries:
            try:
                if self.config.is_tiny_mode:
                    sql = f"INSERT INTO entries (id, headword, headword_clean, definition_{self.suffix}) VALUES (?, ?, ?, ?)"
                else:
                    sql = f"INSERT INTO entries (id, headword, headword_clean, definition_{self.suffix}, grammar_{self.suffix}, example_{self.suffix}) VALUES (?, ?, ?, ?, ?, ?)"
                self.cursor.executemany(sql, entries)
            except Exception as e:
                logger.error(f"Entries insert failed: {e}")
                raise e

        if lookups:
            self._insert_lookups(lookups)
        self.conn.commit()

    def insert_deconstructions(self, deconstructions: List[Tuple], lookups: List[Tuple]) -> None:
        if deconstructions:
            self.cursor.executemany("INSERT INTO deconstructions (word, components) VALUES (?, ?)", deconstructions)
        # Note: Deconstructions no longer have lookups
        self.conn.commit()

    def insert_roots(self, roots: List[Tuple], lookups: List[Tuple]) -> None:
        if roots:
            sql = """
                INSERT INTO roots (
                    id, root, root_clean, 
                    root_meaning, root_info, sanskrit_info
                ) VALUES (?, ?, ?, ?, ?, ?)
            """
            self.cursor.executemany(sql, roots)
        if lookups:
            self._insert_lookups(lookups)
        self.conn.commit()

    def insert_grammar_notes(self, grammar_batch: List[Tuple]) -> None:
        if grammar_batch:
            # [CLEANUP] Always insert into grammar_pack
            self.cursor.executemany("INSERT INTO grammar_notes (key, grammar_pack) VALUES (?, ?)", grammar_batch)
        self.conn.commit()

    def _insert_lookups(self, lookups: List[Tuple]):
        self.cursor.executemany("INSERT INTO lookups (key, target_id, type) VALUES (?, ?, ?)", lookups)