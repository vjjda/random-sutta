-- Path: src/dict_builder/schema.sql

CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    headword TEXT NOT NULL,
    headword_clean TEXT NOT NULL,
    
    definition_html TEXT,
    grammar_html TEXT,
    example_html TEXT,
    
    definition_json TEXT
);

CREATE TABLE IF NOT EXISTS deconstructions (
    id INTEGER PRIMARY KEY,
    lookup_key TEXT NOT NULL,
    split_string TEXT
);

CREATE TABLE IF NOT EXISTS lookups (
    key TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    is_headword BOOLEAN NOT NULL,
    is_inflection BOOLEAN DEFAULT 0 
);

CREATE INDEX IF NOT EXISTS idx_lookups_key ON lookups(key);