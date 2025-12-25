// Path: web/assets/modules/services/sqlite_service.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("SqliteService");

const DB_ZIP_URL = "assets/db/dpd_mini.db.zip";
const IDB_NAME = "DPD_CACHE";
const IDB_STORE = "files";
const IDB_KEY = "dpd_mini.db";

export const SqliteService = {
    db: null,
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
            logger.info("Init", "Initializing SQL.js...");
            
            if (!window.initSqlJs) {
                throw new Error("sql-wasm.js not loaded");
            }

            // Load SQL.js
            const SQL = await window.initSqlJs({
                locateFile: file => `assets/libs/${file}`
            });

            // 1. Try Load from IDB
            let dbBinary = await this._loadFromIndexedDB();
            
            if (!dbBinary) {
                // 2. Fetch Zip & Unpack
                logger.info("Init", "Downloading compressed DB...");
                dbBinary = await this._downloadAndUnzip();
                
                // 3. Cache to IDB
                if (dbBinary) {
                    await this._saveToIndexedDB(dbBinary);
                }
            } else {
                logger.info("Init", "Loaded DB from IndexedDB Cache (Offline Ready).");
            }

            if (!dbBinary) throw new Error("Could not acquire DB binary.");

            this.db = new SQL.Database(new Uint8Array(dbBinary));
            logger.info("Init", "DB Loaded successfully.");
            
            this._loadJsonKeys();
            
            this.isInitializing = false;
            return true;
        } catch (e) {
            logger.error("Init", "Failed to load DB", e);
            this.isInitializing = false;
            return false;
        }
    },
    
    async _loadFromIndexedDB() {
        return new Promise((resolve) => {
            const req = indexedDB.open(IDB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE);
                }
            };
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(IDB_STORE, "readonly");
                const store = tx.objectStore(IDB_STORE);
                const getReq = store.get(IDB_KEY);
                
                getReq.onsuccess = () => {
                    if (getReq.result) resolve(getReq.result);
                    else resolve(null);
                };
                getReq.onerror = () => resolve(null);
            };
            req.onerror = () => resolve(null);
        });
    },

    async _saveToIndexedDB(binary) {
        return new Promise((resolve) => {
            const req = indexedDB.open(IDB_NAME, 1);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(IDB_STORE, "readwrite");
                const store = tx.objectStore(IDB_STORE);
                store.put(binary, IDB_KEY);
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve(); // Ignore error
            };
            req.onerror = () => resolve();
        });
    },
    
    async _downloadAndUnzip() {
        if (!window.JSZip) throw new Error("JSZip not loaded");
        
        const response = await fetch(DB_ZIP_URL);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        
        // Find the .db file inside
        const dbFile = zip.file("dpd_mini.db");
        if (!dbFile) throw new Error("dpd_mini.db not found in zip");
        
        logger.info("Init", "Unzipping DB...");
        return await dbFile.async("arraybuffer");
    },

    _loadJsonKeys() {
        try {
            const res = this.db.exec("SELECT abbr_key, full_key FROM json_keys");
            if (res.length > 0) {
                this._keyMap.fullToAbbr = {};
                this._keyMap.abbrToFull = {};
                
                res[0].values.forEach(row => {
                    const abbr = row[0];
                    const full = row[1];
                    this._keyMap.fullToAbbr[full] = abbr;
                    this._keyMap.abbrToFull[abbr] = full;
                });
            }
        } catch (e) {
            logger.warn("Init", "Could not load json_keys", e);
        }
    },

    search(term) {
        if (!this.db) return null;
        try {
            // OPTIMIZATION: Manual Join logic instead of View
            // 1. Get Target ID & Type from Lookups (Indexed)
            const lookupRes = this.db.exec("SELECT target_id, type FROM lookups WHERE key = ?", [term]);
            if (!lookupRes.length || !lookupRes[0].values.length) return null;
            
            const [targetId, type] = lookupRes[0].values[0];
            
            // 2. Fetch details based on Type
            let result = {
                lookup_key: term,
                target_id: targetId,
                lookup_type: type,
                headword: null,
                definition: null,
                entry_grammar: null,
                entry_example: null,
                grammar_note: null,
                keyMap: this._keyMap // Pass both maps
            };

            // Type 0: Deconstruction
            if (type === 0) {
                const res = this.db.exec("SELECT components FROM deconstructions WHERE id = ?", [targetId]);
                if (res.length) result.definition = res[0].values[0][0];
            } 
            // Type 1: Entry
            else if (type === 1) {
                const res = this.db.exec(
                    "SELECT headword, definition_json, grammar_json, example_json FROM entries WHERE id = ?", 
                    [targetId]
                );
                if (res.length) {
                    const row = res[0].values[0];
                    result.headword = row[0];
                    result.definition = row[1];
                    result.entry_grammar = row[2];
                    result.entry_example = row[3];
                }
            }
            // Type 2: Root
            else if (type === 2) {
                const res = this.db.exec(
                    "SELECT root, definition_json FROM roots WHERE id = ?", 
                    [targetId]
                );
                if (res.length) {
                    const row = res[0].values[0];
                    result.headword = row[0];
                    result.definition = row[1];
                }
            }

            // 3. Always check Grammar Notes
            const gnRes = this.db.exec("SELECT grammar_json FROM grammar_notes WHERE key = ?", [term]);
            if (gnRes.length) {
                result.grammar_note = gnRes[0].values[0][0];
            }
            
            return result;

        } catch (e) {
            logger.error("Search", `Error searching for ${term}`, e);
            return null;
        }
    }
};
