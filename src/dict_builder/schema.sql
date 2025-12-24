-- Path: src/dict_builder/schema.sql

CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    headword TEXT NOT NULL,
    headword_clean TEXT NOT NULL,
    
    definition_html TEXT,  -- Vẫn giữ HTML cho định nghĩa chính (vì format phức tạp)
    
    -- [CHANGED] Lưu trữ dữ liệu ngữ pháp dạng JSON thuần
    grammar_json TEXT,
    
    example_html TEXT,
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
    target_type TEXT CHECK(target_type IN ('entry', 'deconstruction')) NOT NULL,
    is_inflection BOOLEAN DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_headword ON entries(headword_clean);
CREATE INDEX IF NOT EXISTS idx_lookups_key ON lookups(key);
CREATE INDEX IF NOT EXISTS idx_entries_score ON entries(search_score DESC);