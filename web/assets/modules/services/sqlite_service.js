// Path: web/assets/modules/services/sqlite_service.js
import { getLogger } from 'utils/logger.js';
import { initSQLite, withExistDB } from '../../libs/wa-sqlite-index.js';
import { useIdbStorage } from '../../libs/wa-sqlite-idb.js';

const logger = getLogger("SqliteService");

const DB_ZIP_URL = "assets/db/dpd_mini.db.zip";
const DB_NAME = "dpd_mini.db";

export const SqliteService = {
    db: null, // DB Handle
    isInitializing: false,
    _keyMap: {
        fullToAbbr: null, 
        abbrToFull: null
    },

    async init() {
        if (this.db) return true;
        if (this.isInitializing) {
            return new Promise(resolve => {
                const interval = setInterval(() => {
                    if (this.db) {
                        clearInterval(interval);
                        resolve(true);
                    } else if (this.isInitializing === false) { 
                        clearInterval(interval);
                        resolve(false);
                    }
                }, 100);
            });
        }

        this.isInitializing = true;
        try {
            logger.info("Init", "Initializing wa-sqlite with new API...");
            
            // Try to open the DB. If it's empty, useIdbStorage will return a DB
            // where a query to sqlite_master will be empty.
            let dbHandle = await initSQLite(useIdbStorage(DB_NAME));
            
            const tables = await dbHandle.query('SELECT name FROM sqlite_master WHERE type="table" AND name="lookups"');
            
            if (tables.length === 0) {
                logger.info("Init", "DB empty or missing. Downloading & Populating...");
                
                // Close the empty DB handle
                await dbHandle.close();

                // Download & Unzip
                const dbBinary = await this._downloadAndUnzip();
                const dbFile = new File([dbBinary], DB_NAME, { type: 'application/x-sqlite3' });
                
                // Re-initialize with the existing DB file
                dbHandle = await initSQLite(useIdbStorage(DB_NAME, withExistDB(dbFile)));
                logger.info("Init", "Database restored to IndexedDB.");
            } else {
                 logger.info("Init", "Loaded DB from IndexedDB.");
            }
            
            this.db = dbHandle;
            await this._loadJsonKeys();
            
            logger.info("Init", "Ready.");
            this.isInitializing = false;
            return true;

        } catch (e) {
            logger.error("Init", "Failed to init wa-sqlite", e);
            this.isInitializing = false;
            return false;
        }
    },
    
    async _downloadAndUnzip() {
        if (!window.JSZip) throw new Error("JSZip not loaded");
        
        const response = await fetch(DB_ZIP_URL);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        const dbFile = zip.file(DB_NAME);
        if (!dbFile) throw new Error(`${DB_NAME} not found in zip`);
        
        logger.info("Init", "Unzipping DB...");
        return await dbFile.async("arraybuffer");
    },

    async _loadJsonKeys() {
        try {
            const res = await this.db.query("SELECT abbr_key, full_key FROM json_keys");
            if (res.length > 0) {
                this._keyMap.fullToAbbr = {};
                this._keyMap.abbrToFull = {};
                
                res.forEach(row => {
                    const abbr = row.abbr_key;
                    const full = row.full_key;
                    this._keyMap.fullToAbbr[full] = abbr;
                    this._keyMap.abbrToFull[abbr] = full;
                });
            }
        } catch (e) {
            logger.warn("Init", "Could not load json_keys", e);
        }
    },

    async smartSearch(term) {
        if (!this.db || !term) return [];

        const cleanTerm = term.toLowerCase().trim();
        
        const sql = `
            SELECT 
                target_id, 
                type, 
                key,
                (key = :term) as is_exact
            FROM lookups_fts 
            WHERE key MATCH :pattern
            ORDER BY 
                is_exact DESC, 
                abs(length(key) - length(:term)) ASC,
                rank
            LIMIT 20
        `;

        try {
            const ftsRes = await this.db.query(sql, {
                ':term': cleanTerm,
                ':pattern': `${cleanTerm}*`
            });
            
            if (!ftsRes.length) return [];

            const results = [];
            const seenTargets = new Set();
            
            for (const row of ftsRes) {
                const uniqueId = `${row.type}_${row.target_id}`;
                if (seenTargets.has(uniqueId)) {
                    continue;
                }
                seenTargets.add(uniqueId);
                
                const details = await this._fetchDetails(row.target_id, row.type, row.key);
                if (details) results.push(details);
            }
            
            return results;

        } catch (error) {
            logger.error("FTS Search Error:", error);
            return [];
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
                const res = await this.db.query("SELECT components FROM deconstructions WHERE id = :id", { ':id': targetId });
                if (res.length > 0) result.definition = res[0].components;
            } 
            else if (type === 1) { // Entry
                const res = await this.db.query(
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
                const res = await this.db.query(
                    "SELECT root, definition_json FROM roots WHERE id = :id", 
                    { ':id': targetId }
                );
                if (res.length > 0) {
                    const row = res[0];
                    result.headword = row.root;
                    result.definition = row.definition_json;
                }
            }

            const gnRes = await this.db.query("SELECT grammar_json FROM grammar_notes WHERE key = :key", { ':key': term });
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
