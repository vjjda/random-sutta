// Path: web/assets/modules/lookup/dictionaries/pali_dpd.js
import { SqliteConnection } from 'services/sqlite_connection.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("PaliDPD");

export const PaliDPD = {
    connection: null,
    _keyMap: { fullToAbbr: null, abbrToFull: null },

    /**
     * Init dictionary with dynamic config
     * @param {Object} config - { name: "db_name.db", path: "path/to/db.zip" }
     */
    async init(config) {
        if (!config || !config.path) {
            logger.error("Init", "Missing configuration");
            return false;
        }

        // Lazy initialization of connection
        if (!this.connection) {
            this.connection = new SqliteConnection(config.name, config.path);
        }

        const success = await this.connection.init();
        if (success) {
            await this._loadJsonKeys();
        }
        return success;
    },

    async search(term) {
        if (!this.connection) return [];
        if (!term) return [];
        const cleanTerm = term.toLowerCase().trim();
        
        // 1. Parallel Search: Deconstruction (Exact) + Main Lookup (FTS)
        const deconSql = "SELECT components FROM deconstructions WHERE word = ? LIMIT 1";
        
        let mainSql;
        if (cleanTerm.length < 2) {
            // [OPTIMIZATION] Single char -> EXACT MATCH ONLY
            mainSql = `
                SELECT 
                    matches.key, 
                    matches.target_id, 
                    matches.type,
                    CASE 
                        WHEN matches.type = 1 THEN e.headword
                        WHEN matches.type = 0 THEN r.root
                        ELSE matches.key
                    END AS headword,
                    CASE 
                        WHEN matches.type = 1 THEN e.definition_json
                        WHEN matches.type = 0 THEN r.definition_json
                    END AS definition,
                    e.grammar_json AS grammar,
                    e.example_json AS example,
                    gn.grammar_pack AS gn_grammar,
                    1 AS is_exact
                FROM (
                    SELECT key, target_id, type, rank 
                    FROM lookups_fts 
                    WHERE key MATCH :term 
                    LIMIT 20
                ) matches
                LEFT JOIN entries e ON matches.target_id = e.id AND matches.type = 1
                LEFT JOIN roots r ON matches.target_id = r.id AND matches.type = 0
                LEFT JOIN grammar_notes gn ON matches.key = gn.key
                ORDER BY length(matches.key) ASC, matches.rank
            `;
        } else {
            // [STANDARD] Priority Union (Exact + Prefix)
            mainSql = `
                SELECT 
                    matches.key, 
                    matches.target_id, 
                    matches.type,
                    CASE 
                        WHEN matches.type = 1 THEN e.headword
                        WHEN matches.type = 0 THEN r.root
                        ELSE matches.key
                    END AS headword,
                    CASE 
                        WHEN matches.type = 1 THEN e.definition_json
                        WHEN matches.type = 0 THEN r.definition_json
                    END AS definition,
                    e.grammar_json AS grammar,
                    e.example_json AS example,
                    gn.grammar_pack AS gn_grammar,
                    (matches.key = :term AND matches.key = (
                        CASE 
                            WHEN matches.type = 1 THEN e.headword_clean
                            WHEN matches.type = 0 THEN r.root_clean
                            ELSE matches.key
                        END
                    )) AS is_exact
                FROM (
                    SELECT * FROM (SELECT key, target_id, type, rank, 1 AS priority FROM lookups_fts WHERE key MATCH :term LIMIT 20)
                    UNION ALL
                    SELECT * FROM (SELECT key, target_id, type, rank, 2 AS priority FROM lookups_fts WHERE key MATCH :pattern LIMIT 100)
                ) matches
                LEFT JOIN entries e ON matches.target_id = e.id AND matches.type = 1
                LEFT JOIN roots r ON matches.target_id = r.id AND matches.type = 0
                LEFT JOIN grammar_notes gn ON matches.key = gn.key
                GROUP BY matches.type, matches.target_id
                ORDER BY matches.priority ASC, is_exact DESC, length(matches.key) ASC, matches.rank
                LIMIT 20
            `;
        }

        try {
            const [deconRes, ftsRes] = await Promise.all([
                this.connection.run(deconSql, [cleanTerm]),
                this.connection.run(mainSql, {
                    ':term': cleanTerm,
                    ':pattern': `${cleanTerm}*`
                })
            ]);
            
            const results = [];
            const seenTargets = new Set();
            
            // 2. Add Deconstruction Result (if any)
            if (deconRes && deconRes.length > 0) {
                 results.push({
                    lookup_key: cleanTerm,
                    target_id: 0, // Virtual ID
                    lookup_type: -1, // Special Type for Deconstruction
                    headword: cleanTerm,
                    definition: deconRes[0].components,
                    entry_grammar: null,
                    entry_example: null,
                    grammar_note: null,
                    keyMap: this._keyMap,
                    is_deconstruction: true
                });
            }

            // 3. Add FTS Results
            if (ftsRes && ftsRes.length > 0) {
                for (const row of ftsRes) {
                    const uniqueId = `${row.type}_${row.target_id}`;
                    if (seenTargets.has(uniqueId)) continue;
                    seenTargets.add(uniqueId);
                    
                    results.push({
                        lookup_key: row.key,
                        target_id: row.target_id,
                        lookup_type: row.type,
                        headword: row.headword,
                        definition: row.definition,
                        entry_grammar: row.grammar,
                        entry_example: row.example,
                        grammar_note: row.gn_grammar,
                        keyMap: this._keyMap
                    });
                }
            }
            
            return results;
        } catch (error) {
            logger.error("Search Error", error);
            return [];
        }
    },

    async _loadJsonKeys() {
        try {
            const res = await this.connection.run("SELECT abbr_key, full_key FROM json_keys");
            if (res.length > 0) {
                this._keyMap.fullToAbbr = {};
                this._keyMap.abbrToFull = {};
                res.forEach(row => {
                    this._keyMap.fullToAbbr[row.full_key] = row.abbr_key;
                    this._keyMap.abbrToFull[row.abbr_key] = row.full_key;
                });
            }
        } catch (e) {
            logger.warn("Keys Load Error", e);
        }
    }
};
