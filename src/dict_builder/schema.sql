-- Path: src/dict_builder/schema.sql

-- 1. Metadata: Lưu thông tin phiên bản
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- 2. Entries: Chứa từ vựng chính
CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    headword TEXT NOT NULL,       -- Từ hiển thị
    headword_clean TEXT NOT NULL, -- Từ không dấu (để sort)
    
    -- HTML Rendered (Semantic HTML)
    definition_html TEXT,         -- Summary + Meaning
    grammar_html TEXT,            -- Bảng ngữ pháp
    example_html TEXT,            -- Ví dụ
    
    -- Raw Data (JSON)
    data_json TEXT,               -- Dữ liệu thô để App xử lý logic riêng
    
    search_score INTEGER DEFAULT 0
);

-- 3. Deconstructions: Tách từ ghép (Optional display)
CREATE TABLE IF NOT EXISTS deconstructions (
    id INTEGER PRIMARY KEY,
    lookup_key TEXT NOT NULL,
    split_string TEXT,            -- "na + h + ida"
    html TEXT                     -- Pre-rendered HTML
);

-- 4. Lookups: Chỉ mục tìm kiếm hợp nhất
CREATE TABLE IF NOT EXISTS lookups (
    key TEXT NOT NULL,            -- Lowercase, no diacritics
    target_id INTEGER NOT NULL,   -- ID của entry hoặc deconstruction
    target_type TEXT CHECK(target_type IN ('entry', 'deconstruction')) NOT NULL,
    is_inflection BOOLEAN DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entries_headword ON entries(headword_clean);
CREATE INDEX IF NOT EXISTS idx_lookups_key ON lookups(key);
CREATE INDEX IF NOT EXISTS idx_deconstructions_key ON deconstructions(lookup_key);