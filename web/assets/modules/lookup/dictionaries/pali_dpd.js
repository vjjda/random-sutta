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
        
        // Optimized FTS Query: Fetch EVERYTHING in one go
        const sql = `
            SELECT 
                sub.key, 
                sub.target_id, 
                sub.type,
                sub.headword,
                sub.definition,
                sub.grammar,
                sub.example,
                sub.gn_grammar,
                ((sub.key = :term) AND (sub.key = sub.keyword)) AS is_exact
            FROM (
                SELECT 
                    lf.key, 
                    lf.target_id, 
                    lf.type, 
                    lf.rank,
                    -- Determine Keyword (for sorting) & Headword (for display)
                    CASE 
                        WHEN lf.type = 1 THEN e.headword
                        WHEN lf.type = 2 THEN r.root
                        ELSE lf.key
                    END AS headword,
                    CASE 
                        WHEN lf.type = 1 THEN e.headword_clean
                        WHEN lf.type = 0 THEN d.word
                        WHEN lf.type = 2 THEN r.root_clean
                        ELSE lf.key
                    END AS keyword,
                    -- Extract Data
                    CASE 
                        WHEN lf.type = 1 THEN e.definition_json
                        WHEN lf.type = 2 THEN r.definition_json
                        WHEN lf.type = 0 THEN d.components
                    END AS definition,
                    e.grammar_json AS grammar,
                    e.example_json AS example,
                    gn.grammar_json AS gn_grammar
                FROM lookups_fts lf
                LEFT JOIN entries e ON lf.target_id = e.id AND lf.type = 1
                LEFT JOIN deconstructions d ON lf.target_id = d.id AND lf.type = 0
                LEFT JOIN roots r ON lf.target_id = r.id AND lf.type = 2
                LEFT JOIN grammar_notes gn ON lf.key = gn.key
                WHERE lf.key MATCH :pattern
            ) sub
            ORDER BY is_exact DESC, length(sub.key) ASC, sub.rank
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
