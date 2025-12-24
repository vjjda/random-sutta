-- Path: src/dict_builder/schema.sql

CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    headword TEXT NOT NULL,
    headword_clean TEXT NOT NULL,
    
    -- HTML Rendered (Chỉ giữ lại cái cần thiết để hiển thị)
    definition_html TEXT,
    grammar_html TEXT,
    example_html TEXT,
    
    -- [REMOVED] data_json (Gây tốn dung lượng)
    
    -- Search Score: Dùng ebt_count từ DB gốc
    search_score INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS deconstructions (
    id INTEGER PRIMARY KEY,
    lookup_key TEXT NOT NULL,
    split_string TEXT            -- Chỉ cần lưu chuỗi "a + b"
    -- [REMOVED] html (Frontend tự render)
);

CREATE TABLE IF NOT EXISTS lookups (
    key TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    target_type TEXT CHECK(target_type IN ('entry', 'deconstruction')) NOT NULL,
    is_inflection BOOLEAN DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_headword ON entries(headword_clean);
CREATE INDEX IF NOT EXISTS idx_lookups_key ON lookups(key);
-- Index cho score để sort kết quả tìm kiếm nhanh hơn
CREATE INDEX IF NOT EXISTS idx_entries_score ON entries(search_score DESC);