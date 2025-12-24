-- Path: src/dict_builder/schema.sql

CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    headword TEXT NOT NULL,
    headword_clean TEXT NOT NULL,
    
    -- [CHANGED] TEXT để dễ đọc (debug), thay vì BLOB
    definition_html TEXT,
    grammar_html TEXT,
    example_html TEXT
    
    -- [REMOVED] search_score
);

CREATE TABLE IF NOT EXISTS deconstructions (
    id INTEGER PRIMARY KEY,
    lookup_key TEXT NOT NULL,
    split_string TEXT
);

CREATE TABLE IF NOT EXISTS lookups (
    key TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    
    -- [CHANGED] is_headword: 1 = trỏ về bảng entries, 0 = trỏ về bảng deconstructions
    is_headword BOOLEAN NOT NULL,
    
    is_inflection BOOLEAN DEFAULT 0 
);

CREATE INDEX IF NOT EXISTS idx_entries_headword ON entries(headword_clean);
CREATE INDEX IF NOT EXISTS idx_lookups_key ON lookups(key);
-- [REMOVED] Index search_score