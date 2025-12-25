// Path: web/assets/modules/services/sqlite_service.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("SqliteService");

export const SqliteService = {
    db: null,
    isInitializing: false,
    _jsonKeys: null, // Cache for json_keys table

    async init() {
        if (this.db) return true;
        if (this.isInitializing) {
            // Simple wait mechanism
            return new Promise(resolve => {
                const interval = setInterval(() => {
                    if (this.db) {
                        clearInterval(interval);
                        resolve(true);
                    } else if (this.isInitializing === false) { // Failed
                        clearInterval(interval);
                        resolve(false);
                    }
                }, 100);
            });
        }

        this.isInitializing = true;
        try {
            logger.info("Init", "Initializing SQL.js...");
            
            if (!window.initSqlJs) {
                throw new Error("sql-wasm.js not loaded");
            }

            const SQL = await window.initSqlJs({
                locateFile: file => `assets/libs/${file}`
            });

            logger.info("Init", "Fetching dpd_mini.db...");
            const response = await fetch("assets/db/dpd_mini.db");
            if (!response.ok) throw new Error(`Failed to fetch DB: ${response.status}`);
            const buf = await response.arrayBuffer();

            this.db = new SQL.Database(new Uint8Array(buf));
            logger.info("Init", "DB Loaded successfully.");
            
            // Load JSON Keys mapping
            this._loadJsonKeys();
            
            this.isInitializing = false;
            return true;
        } catch (e) {
            logger.error("Init", "Failed to load DB", e);
            this.isInitializing = false;
            return false;
        }
    },
    
    _loadJsonKeys() {
        try {
            const res = this.db.exec("SELECT abbr_key, full_key FROM json_keys");
            if (res.length > 0) {
                this._jsonKeys = {};
                res[0].values.forEach(row => {
                    // Map Full Key -> Abbr Key (e.g., 'pos' -> 'p')
                    // Because JSON in DB uses Abbr Keys, but Renderer uses Full Keys to look up.
                    this._jsonKeys[row[1]] = row[0];
                });
            }
        } catch (e) {
            logger.warn("Init", "Could not load json_keys", e);
        }
    },

    search(term) {
        if (!this.db) return null;
        try {
            // Using grand_lookups view for unified access
            // Columns: lookup_key, target_id, lookup_type, headword, definition, grammar_note, entry_grammar, entry_example
            const sql = "SELECT * FROM grand_lookups WHERE lookup_key = ?";
            const results = this.db.exec(sql, [term]);
            
            if (!results.length) return null;

            const columns = results[0].columns;
            const values = results[0].values[0];
            
            // Map to object
            const row = {};
            columns.forEach((col, index) => {
                row[col] = values[index];
            });
            
            // Resolve JSON keys in 'definition' and others if they are JSON strings
            // Note: The DB stores JSON strings. We should parse them here or in renderer.
            // Let's just return the raw DB row, but maybe parse known JSON fields.
            
            return {
                ...row,
                jsonKeys: this._jsonKeys
            };

        } catch (e) {
            logger.error("Search", `Error searching for ${term}`, e);
            return null;
        }
    }
};
