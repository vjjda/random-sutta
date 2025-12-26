// Path: web/assets/modules/lookup/dictionaries/pali_dpd.js
import { SqliteConnection } from 'services/sqlite_connection.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("PaliDPD");

// Configuration
const DB_NAME = "dpd_mini.db";
// TODO: Update path when files are moved to assets/db/dictionaries/
const DB_ZIP_URL = "assets/db/dpd_mini.db.zip"; 

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
        
        // FTS Query
        const sql = `
            SELECT target_id, type, key, (key = :term) as is_exact
            FROM lookups_fts 
            WHERE key MATCH :pattern
            ORDER BY is_exact DESC, abs(length(key) - length(:term)) ASC, rank
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
                
                const details = await this._fetchDetails(row.target_id, row.type, row.key);
                if (details) results.push(details);
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
    },

    async _fetchDetails(targetId, type, term) {
        let result = {
            lookup_key: term,
            target_id: targetId,
            lookup_type: type,
            headword: null,
            definition: null,
            entry_grammar: null,
            entry_example: null,
            grammar_note: null,
            keyMap: this._keyMap
        };

        try {
            if (type === 0) { // Deconstruction
                const res = await this.connection.run("SELECT components FROM deconstructions WHERE id = :id", { ':id': targetId });
                if (res.length > 0) result.definition = res[0].components;
            } 
            else if (type === 1) { // Entry
                const res = await this.connection.run(
                    "SELECT headword, definition_json, grammar_json, example_json FROM entries WHERE id = :id", 
                    { ':id': targetId }
                );
                if (res.length > 0) {
                    const row = res[0];
                    result.headword = row.headword;
                    result.definition = row.definition_json;
                    result.entry_grammar = row.grammar_json;
                    result.entry_example = row.example_json;
                }
            }
            else if (type === 2) { // Root
                const res = await this.connection.run(
                    "SELECT root, definition_json FROM roots WHERE id = :id", 
                    { ':id': targetId }
                );
                if (res.length > 0) {
                    const row = res[0];
                    result.headword = row.root;
                    result.definition = row.definition_json;
                }
            }

            const gnRes = await this.connection.run("SELECT grammar_json FROM grammar_notes WHERE key = :key", { ':key': term });
            if (gnRes.length > 0) {
                result.grammar_note = gnRes[0].grammar_json;
            }
        } catch (e) {
            logger.error("FetchDetails Error", e);
            return null;
        }
        return result;
    }
};
