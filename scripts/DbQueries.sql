/* 
  TEST QUERY: SEARCH LOGIC (MATCHING PALI_DPD.JS)
  
  Logic:
  1. Nếu term < 2 ký tự (vd: 'a'): Dùng Query "SIMPLE EXACT" (nhanh tuyệt đối).
  2. Nếu term >= 2 ký tự (vd: 'va'): Dùng Query "PRIORITY UNION" (Exact + Prefix).
*/

-- [INPUT] Thay đổi từ khóa tại đây
WITH inputs(term) AS (
    VALUES('va') -- Thử 'a' để test case ngắn, 'va' để test case dài
)

-- =======================================================================
-- CASE A: PRIORITY UNION (Dành cho từ >= 2 ký tự - MẶC ĐỊNH)
-- =======================================================================
SELECT 
    matches.key, 
    matches.target_id, 
    -- Calculate Keyword for display/logic
    CASE 
        WHEN matches.type = 1 THEN e.headword_clean
        WHEN matches.type = 0 THEN d.word
        WHEN matches.type = 2 THEN r.root_clean
        ELSE matches.key
    END AS keyword,
    tt.table_name,
    -- LOGIC IS_EXACT (LỚP NGOÀI)
    (matches.key = matches.term AND matches.key = (
        CASE 
            WHEN matches.type = 1 THEN e.headword_clean
            WHEN matches.type = 0 THEN d.word
            WHEN matches.type = 2 THEN r.root_clean
            ELSE matches.key
        END
    )) AS is_exact
FROM (
    -- Priority 1: Exact Match (Fastest & Most Relevant)
    SELECT * FROM (
        SELECT 
            lf.key, lf.target_id, lf.type, lf.rank, i.term, 1 AS priority
        FROM lookups_fts lf
        JOIN inputs i
        WHERE lf.key MATCH i.term
        LIMIT 20
    )

    UNION ALL

    -- Priority 2: Prefix Match (Coverage)
    SELECT * FROM (
        SELECT 
            lf.key, lf.target_id, lf.type, lf.rank, i.term, 2 AS priority
        FROM lookups_fts lf
        JOIN inputs i
        WHERE lf.key MATCH (i.term || '*')
        LIMIT 100
    )
) matches
LEFT JOIN table_types tt ON matches.type = tt.type
LEFT JOIN entries e ON matches.target_id = e.id AND matches.type = 1
LEFT JOIN deconstructions d ON matches.target_id = d.id AND matches.type = 0
LEFT JOIN roots r ON matches.target_id = r.id AND matches.type = 2
GROUP BY matches.type, matches.target_id -- Deduplicate Union results
ORDER BY 
    matches.priority ASC,
    is_exact DESC, 
    length(matches.key) ASC, 
    matches.rank
LIMIT 20;

-- =======================================================================
-- CASE B: SIMPLE EXACT (Dành cho từ < 2 ký tự - UNCOMMENT ĐỂ TEST)
-- =======================================================================
/*
SELECT 
    matches.key, 
    matches.target_id, 
    CASE 
        WHEN matches.type = 1 THEN e.headword_clean
        WHEN matches.type = 0 THEN d.word
        WHEN matches.type = 2 THEN r.root_clean
        ELSE matches.key
    END AS keyword,
    tt.table_name,
    1 AS is_exact -- Luôn là exact
FROM (
    SELECT 
        lf.key, lf.target_id, lf.type, lf.rank, i.term
    FROM lookups_fts lf
    JOIN inputs i
    WHERE lf.key MATCH i.term
    LIMIT 20
) matches
LEFT JOIN table_types tt ON matches.type = tt.type
LEFT JOIN entries e ON matches.target_id = e.id AND matches.type = 1
LEFT JOIN deconstructions d ON matches.target_id = d.id AND matches.type = 0
LEFT JOIN roots r ON matches.target_id = r.id AND matches.type = 2
ORDER BY 
    length(matches.key) ASC, 
    matches.rank;
*/