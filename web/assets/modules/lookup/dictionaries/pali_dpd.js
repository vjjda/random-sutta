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
            // New Lookup System: Decoupled Logic
            
            // 1. Update Lookup Parameters (for View)
            await this.connection.run(
                "UPDATE _lookup_params SET term = :term", 
                { ':term': cleanTerm }
            );

            // 2. Run Queries Sequentially (Safe for WASM)
            // Query A: Main Exact Matches (via View)
            const resultsMain = await this.connection.run("SELECT * FROM view_lookup_results");
            
            // Query B: Deconstruction Info (Direct Table)
            const resultsDecon = await this.connection.run(
                "SELECT components FROM deconstructions WHERE word = :term", 
                { ':term': cleanTerm }
            );

            let finalRows = resultsMain || [];
            
            // 3. Inject Deconstruction Row (if found)
            if (resultsDecon && resultsDecon.length > 0) {
                const deconRow = resultsDecon[0];
                const syntheticRow = {
                    key: cleanTerm,
                    target_id: 0,
                    type: -1, // DECON TYPE
                    headword: cleanTerm,
                    definition: deconRow.components,
                    grammar: null,
                    example: null,
                    gn_grammar: null,
                    root_meaning: null,
                    root_info: null,
                    sanskrit_info: null,
                    priority: 0 // Top Priority
                };
                // Prepend
                finalRows = [syntheticRow, ...finalRows];
            }

            if (!finalRows.length) return [];

            const finalResults = [];
            const seenTargets = new Set();
            
            for (const row of finalRows) {
                const uniqueId = `${row.type}_${row.target_id}`;
                if (seenTargets.has(uniqueId)) continue;
                seenTargets.add(uniqueId);
                
                finalResults.push({
                    lookup_key: row.key,
                    target_id: row.target_id,
                    lookup_type: row.type,
                    headword: row.headword,
                    definition: row.definition,
                    entry_grammar: row.grammar,
                    entry_example: row.example,
                    grammar_note: row.gn_grammar,
                    // Root specific fields
                    root_meaning: row.root_meaning,
                    root_info: row.root_info,
                    sanskrit_info: row.sanskrit_info,
                    
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
