WITH inputs(term) AS (
    VALUES('va') 
)
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