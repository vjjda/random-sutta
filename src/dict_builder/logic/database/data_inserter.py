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
                # [REFACTOR] Insert into flattened columns (31 columns)
                # Order: id, hw, hw_clean, pos, GRAMMAR, meaning, lit, constr, degree, case, stem, pattern, ...
                sql = """
                    INSERT INTO entries (
                        id, headword, headword_clean, pos, grammar, 
                        meaning, meaning_lit, construction, degree, plus_case, 
                        stem, pattern,
                        root_family, root_info, root_in_sandhi, 
                        base, derivative, phonetic, compound, 
                        antonym, synonym, variant, 
                        commentary, notes, cognate, link, non_ia, 
                        sanskrit, sanskrit_root, 
                        example_1, example_2
                    ) VALUES (
                        ?, ?, ?, ?, ?, 
                        ?, ?, ?, ?, ?, 
                        ?, ?,
                        ?, ?, ?, 
                        ?, ?, ?, ?, 
                        ?, ?, ?, 
                        ?, ?, ?, ?, ?, 
                        ?, ?, 
                        ?, ?
                    )
                """
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
                    root_meaning, root_group, root_sign,
                    sanskrit_root, sanskrit_root_class, sanskrit_root_meaning
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            self.cursor.executemany(sql, roots)
        if lookups:
            self._insert_lookups(lookups)
        self.conn.commit()

    def _insert_lookups(self, lookups: List[Tuple]):
        if not lookups:
            return
        
        # Check dimensionality of the first item
        first_item = lookups[0]
        if len(first_item) == 4:
            # Schema: key, type, target_id, inflection_map
            self.cursor.executemany("INSERT INTO lookups (key, type, target_id, inflection_map) VALUES (?, ?, ?, ?)", lookups)
        else:
            # Schema: key, type, target_id
            self.cursor.executemany("INSERT INTO lookups (key, type, target_id) VALUES (?, ?, ?)", lookups)