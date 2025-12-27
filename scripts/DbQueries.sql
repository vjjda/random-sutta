/*
 * Script tìm kiếm từ điển (Pure SQL Version)
 * Cách dùng: Thay đổi giá trị trong CTE 'input_param' ở dòng dưới đây.
 */
WITH input_param AS (
    -- ▼▼▼ NHẬP TỪ KHÓA TÌM KIẾM TẠI ĐÂY (VÍ DỤ: 'metta') ▼▼▼
    SELECT 'vuttañhetaṃ' AS term
),
-- Tạo tập hợp kết quả tìm kiếm từ FTS
ft_results AS (
    SELECT * FROM (
        -- Priority 1: Tìm kiếm chính xác (Exact match)
        SELECT key, target_id, type, rank, 1 AS priority
        FROM lookups_fts
        WHERE lookups_fts MATCH (SELECT term FROM input_param)
        LIMIT 20
    )
    UNION ALL
    SELECT * FROM (
        -- Priority 2: Tìm kiếm tiền tố (Prefix match: term*)
        SELECT key, target_id, type, rank, 2 AS priority
        FROM lookups_fts
        WHERE lookups_fts MATCH (SELECT term FROM input_param) || '*'
        LIMIT 100
    )
),
-- Kết hợp và xử lý dữ liệu (tương đương logic JS)
raw_matches AS (
    SELECT 
        key, target_id, type, rank, priority
    FROM ft_results
)
SELECT 
    matches.key, 
    matches.target_id, 
    matches.type,
    -- Xác định Headword dựa trên Type
    CASE 
        WHEN matches.type = 1 THEN e.headword
        WHEN matches.type = 2 THEN r.root
        ELSE matches.key
    END AS headword,
    -- Xác định Definition dựa trên Type
    CASE 
        WHEN matches.type = 1 THEN e.definition_json
        WHEN matches.type = 2 THEN r.definition_json
        WHEN matches.type = 0 THEN d.components
    END AS definition,
    e.grammar_json AS grammar,
    e.example_json AS example,
    gn.grammar_pack AS gn_grammar,
    -- Logic tính is_exact
    (
        matches.key = (SELECT term FROM input_param) 
        AND 
        matches.key = (
            CASE 
                WHEN matches.type = 1 THEN e.headword_clean
                WHEN matches.type = 0 THEN d.word
                WHEN matches.type = 2 THEN r.root_clean
                ELSE matches.key
            END
        )
    ) AS is_exact
FROM raw_matches matches
LEFT JOIN entries e ON matches.target_id = e.id AND matches.type = 1
LEFT JOIN deconstructions d ON matches.target_id = d.id AND matches.type = 0
LEFT JOIN roots r ON matches.target_id = r.id AND matches.type = 2
LEFT JOIN grammar_notes gn ON matches.key = gn.key
GROUP BY matches.type, matches.target_id
ORDER BY 
    matches.priority ASC, 
    is_exact DESC, 
    length(matches.key) ASC, 
    matches.rank
LIMIT 20;