// Path: web/assets/modules/lookup/dictionaries/pali_dpd.js
import { SqliteConnection } from 'services/sqlite_connection.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("PaliDPD");

// Configuration
const DB_NAME = "dpd_mini.db";
const DB_ZIP_URL = "assets/db/dictionaries/dpd_mini.db.zip"; 

export const PaliDPD = {
    connection: new SqliteConnection(DB_NAME, DB_ZIP_URL),
    _keyMap: { fullToAbbr: null, abbrToFull: null },

    async init() {
        const success = await this.connection.init();
        if (success) {
            await this._loadJsonKeys();
        }
        return success;
    },

    async search(term) {
        if (!term) return [];
        const cleanTerm = term.toLowerCase().trim();
        
        // Optimized Query: Deferred Join Pattern
        // 1. Inner query: Quickly find top 50 candidates using only FTS index (no joins).
        //    Sort by length first to prioritize exact matches (e.g. 'va' < 'vacca').
        // 2. Outer query: Join details only for those candidates and calc exact score.
        const sql = `
            SELECT 
                matches.key, 
                matches.target_id, 
                matches.type,
                -- Fetch Details
                CASE 
                    WHEN matches.type = 1 THEN e.headword
                    WHEN matches.type = 2 THEN r.root
                    ELSE matches.key
                END AS headword,
                CASE 
                    WHEN matches.type = 1 THEN e.definition_json
                    WHEN matches.type = 2 THEN r.definition_json
                    WHEN matches.type = 0 THEN d.components
                END AS definition,
                e.grammar_json AS grammar,
                e.example_json AS example,
                gn.grammar_json AS gn_grammar,
                -- Calc Exact Match Score
                (matches.key = :term AND matches.key = (
                    CASE 
                        WHEN matches.type = 1 THEN e.headword_clean
                        WHEN matches.type = 0 THEN d.word
                        WHEN matches.type = 2 THEN r.root_clean
                        ELSE matches.key
                    END
                )) AS is_exact
            FROM (
                SELECT key, target_id, type, rank
                FROM lookups_fts 
                WHERE key MATCH :pattern
                ORDER BY length(key) ASC, rank
                LIMIT 50
            ) matches
            LEFT JOIN entries e ON matches.target_id = e.id AND matches.type = 1
            LEFT JOIN deconstructions d ON matches.target_id = d.id AND matches.type = 0
            LEFT JOIN roots r ON matches.target_id = r.id AND matches.type = 2
            LEFT JOIN grammar_notes gn ON matches.key = gn.key
            ORDER BY is_exact DESC, length(matches.key) ASC, matches.rank
            LIMIT 20
        `;

        try {
            const ftsRes = await this.connection.run(sql, {
                ':term': cleanTerm,
                ':pattern': `${cleanTerm}*`
            });
            
            if (!ftsRes.length) return [];

            const results = [];
            const seenTargets = new Set();
            
            for (const row of ftsRes) {
                const uniqueId = `${row.type}_${row.target_id}`;
                if (seenTargets.has(uniqueId)) continue;
                seenTargets.add(uniqueId);
                
                // Map DB row directly to result object
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
