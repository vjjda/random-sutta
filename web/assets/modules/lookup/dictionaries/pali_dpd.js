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
        
        try {
            // Optimized Lookup System: Using Specialized View (Exact Match + Decon Union)
            // Strategy: Union Keys First -> Join Data Later (Performance: < 1ms)
            
            // 1. Update Lookup Parameters
            await this.connection.run(
                "UPDATE _lookup_params SET term = :term", 
                { ':term': cleanTerm }
            );

            // 2. Fetch Results
            const results = await this.connection.run("SELECT * FROM view_lookup_results");

            if (!results.length) return [];

            const finalResults = [];
            const seenTargets = new Set();
            
            for (const row of results) {
                const uniqueId = `${row.type}_${row.target_id}`;
                if (seenTargets.has(uniqueId)) continue;
                seenTargets.add(uniqueId);
                
                // Logic Definition
                let finalDef = null;
                
                if (row.type === -1) {
                    // Deconstruction: components are now in 'meaning' column
                    finalDef = row.meaning;
                } else {
                    // Entry: Reconstruct JSON object from columns
                    const defObj = {
                        p: row.pos,
                        m: row.meaning,
                        c: row.construction,
                        d: row.degree,
                        ml: row.meaning_origin, // Mapped from alias 'meaning_origin'
                        pc: row.plus_case
                    };
                    finalDef = JSON.stringify(defObj);
                }

                finalResults.push({
                    lookup_key: row.key,
                    target_id: row.target_id,
                    lookup_type: row.type,
                    headword: row.headword,
                    
                    definition: finalDef,
                    
                    entry_grammar: row.grammar,
                    entry_example: row.example,
                    grammar_note: row.gn_grammar,
                    // Root specific fields
                    // In new View, root_meaning is merged into 'meaning' column
                    root_meaning: row.meaning, 
                    root_info: row.root_info,
                    sanskrit_info: row.sanskrit_info,
                    root_meaning_origin: row.meaning_origin, // Pass Sanskrit Meaning
                    
                    keyMap: this._keyMap,
                    is_deconstruction: (row.type === -1)
                });
            }
            return finalResults;
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
