-- Path: src/dict_builder/schema.sql

CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    headword TEXT NOT NULL,
    headword_clean TEXT NOT NULL,
    
    -- [OPTIMIZED] Chuyển sang BLOB để lưu binary đã nén zlib
    definition_html BLOB,
    grammar_html BLOB,
    example_html BLOB,
    
    search_score INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS deconstructions (
    id INTEGER PRIMARY KEY,
    lookup_key TEXT NOT NULL,
    split_string TEXT
);

CREATE TABLE IF NOT EXISTS lookups (
    key TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    
    -- [OPTIMIZED] Dùng số nguyên: 0=entry, 1=deconstruction
    target_type INTEGER NOT NULL, 
    
    -- [OPTIMIZED] Gom nhóm: 1=inflection, 0=headword (giữ nguyên logic nhưng chú ý kiểu dữ liệu)
    is_inflection INTEGER DEFAULT 0 
);

CREATE INDEX IF NOT EXISTS idx_entries_headword ON entries(headword_clean);
CREATE INDEX IF NOT EXISTS idx_lookups_key ON lookups(key);
CREATE INDEX IF NOT EXISTS idx_entries_score ON entries(search_score DESC);