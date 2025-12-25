// Path: web/assets/modules/services/sqlite_service.js
import { getLogger } from 'utils/logger.js';
import SQLiteAsyncESMFactory from 'wa-sqlite/wa-sqlite-async.mjs';
import * as SQLite from 'wa-sqlite/sqlite-api.js';
import { IDBBatchAtomicVFS } from 'wa-sqlite/IDBBatchAtomicVFS.js';

const logger = getLogger("SqliteService");

const DB_ZIP_URL = "assets/db/dpd_mini.db.zip";
const DB_NAME = "dpd_mini.db";
const VFS_NAME = "idb";

export const SqliteService = {
    sqlite3: null,
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
            logger.info("Init", "Initializing wa-sqlite with IndexedDB Backend...");
            
            // 1. Initialize SQLite Module
            const module = await SQLiteAsyncESMFactory();
            this.sqlite3 = SQLite.Factory(module);
            
            // 2. Register IDB VFS
            const vfs = new IDBBatchAtomicVFS(VFS_NAME, module, { idbName: "DPD_CACHE_V2" });
            await vfs.isReady();
            this.sqlite3.vfs_register(vfs, true);

            // 3. Open DB (Creates file in VFS if not exists)
            this.db = await this.sqlite3.open_v2(
                DB_NAME, 
                SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE, 
                VFS_NAME
            );

            // 4. Check if valid (has tables)
            let tableCheck = [];
            try {
                tableCheck = await this._exec("SELECT name FROM sqlite_master WHERE type='table' AND name='lookups'");
            } catch (e) {
                // likely empty
            }

            if (tableCheck.length === 0 || tableCheck[0].values.length === 0) {
                logger.info("Init", "DB empty or missing. Downloading & Populating...");
                
                if (this.db) {
                    await this.sqlite3.close(this.db);
                    this.db = null;
                }

                // Download & Unzip
                const dbBinary = await this._downloadAndUnzip();
                
                // Hydrate using deserialize + backup
                await this._hydrateFromBinary(module, dbBinary);
                
                // Re-open persistent DB
                this.db = await this.sqlite3.open_v2(
                    DB_NAME, 
                    SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE, 
                    VFS_NAME
                );
                
                logger.info("Init", "Database restored to IndexedDB.");
            } else {
                 logger.info("Init", "Loaded DB from IndexedDB VFS.");
            }

            logger.info("Init", "Ready.");
            await this._loadJsonKeys();
            
            this.isInitializing = false;
            return true;
        } catch (e) {
            logger.error("Init", "Failed to init wa-sqlite", e);
            this.isInitializing = false;
            return false;
        }
    },
    
    async _hydrateFromBinary(module, dbBinary) {
        const sqlite3_deserialize = module.cwrap('sqlite3_deserialize', 'number', ['number', 'string', 'number', 'number', 'number', 'number']);
        const sqlite3_backup_init = module.cwrap('sqlite3_backup_init', 'number', ['number', 'string', 'number', 'string']);
        const sqlite3_backup_step = module.cwrap('sqlite3_backup_step', 'number', ['number', 'number']);
        const sqlite3_backup_finish = module.cwrap('sqlite3_backup_finish', 'number', ['number']);

        const pData = module._sqlite3_malloc(dbBinary.byteLength);
        if (!pData) throw new Error("Failed to allocate memory for DB");
        module.HEAPU8.set(new Uint8Array(dbBinary), pData);

        const memDb = await this.sqlite3.open_v2(':memory:', SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_MEMORY);

        const rc = sqlite3_deserialize(
            memDb, 'main', pData, dbBinary.byteLength, dbBinary.byteLength, 
            SQLite.SQLITE_DESERIALIZE_FREEONCLOSE | SQLite.SQLITE_DESERIALIZE_RESIZEABLE
        );
        
        if (rc !== SQLite.SQLITE_OK) {
            await this.sqlite3.close(memDb);
            throw new Error(`sqlite3_deserialize failed with code: ${rc}`);
        }

        const destDb = await this.sqlite3.open_v2(DB_NAME, SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE, VFS_NAME);

        logger.info("Init", "Starting backup from Memory to IndexedDB...");
        const pBackup = await sqlite3_backup_init(destDb, 'main', memDb, 'main');
        if (!pBackup) {
            await this.sqlite3.close(memDb);
            await this.sqlite3.close(destDb);
            throw new Error("sqlite3_backup_init failed");
        }

        const stepRc = await sqlite3_backup_step(pBackup, -1);
        const finishRc = await sqlite3_backup_finish(pBackup);

        if (stepRc !== SQLite.SQLITE_DONE || finishRc !== SQLite.SQLITE_OK) {
            logger.error(`Backup failed! Step: ${stepRc}, Finish: ${finishRc}. Error: ${this.sqlite3.errmsg(destDb)}`);
            await this.sqlite3.close(memDb);
            await this.sqlite3.close(destDb);
            throw new Error(`Backup failed! Step: ${stepRc}, Finish: ${finishRc}`);
        }
        
        await this.sqlite3.close(memDb);
        await this.sqlite3.close(destDb);
    },
    
    async _downloadAndUnzip() {
        if (!window.JSZip) throw new Error("JSZip not loaded");
        
        const response = await fetch(DB_ZIP_URL);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        const dbFile = zip.file("dpd_mini.db");
        if (!dbFile) throw new Error("dpd_mini.db not found in zip");
        
        logger.info("Init", "Unzipping DB...");
        return await dbFile.async("arraybuffer");
    },

    async _loadJsonKeys() {
        try {
            const res = await this._exec("SELECT abbr_key, full_key FROM json_keys");
            if (res.length > 0 && res[0].values.length > 0) {
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
    
    async _exec(sql, params = []) {
        if (!this.db) return [];
        
        const rows = [];
        const columns = [];
        
        for await (const stmt of this.sqlite3.statements(this.db, sql)) {
            if (params.length > 0) {
                 for (let i = 0; i < params.length; i++) {
                     const val = params[i];
                     if (typeof val === 'number') this.sqlite3.bind_double(stmt, i + 1, val);
                     else if (val === null) this.sqlite3.bind_null(stmt, i + 1);
                     else this.sqlite3.bind_text(stmt, i + 1, String(val));
                 }
            }
            
            if (columns.length === 0) {
                const colCount = this.sqlite3.column_count(stmt);
                for (let i = 0; i < colCount; i++) {
                    columns.push(this.sqlite3.column_name(stmt, i));
                }
            }
            
            while (await this.sqlite3.step(stmt) === SQLite.SQLITE_ROW) {
                const row = [];
                for (let i = 0; i < columns.length; i++) {
                     const type = this.sqlite3.column_type(stmt, i);
                     switch (type) {
                         case SQLite.SQLITE_INTEGER:
                         case SQLite.SQLITE_FLOAT:
                             row.push(this.sqlite3.column_double(stmt, i));
                             break;
                         case SQLite.SQLITE_TEXT:
                             row.push(this.sqlite3.column_text(stmt, i));
                             break;
                         case SQLite.SQLITE_BLOB:
                             row.push(null);
                             break;
                         case SQLite.SQLITE_NULL:
                             row.push(null);
                             break;
                     }
                }
                rows.push(row);
            }
        }
        
        if (columns.length === 0 && rows.length === 0) return [];
        return [{ columns, values: rows }];
    },

    /**
     * Tìm kiếm thông minh sử dụng FTS5
     * @param {string} term - Từ khóa tra cứu
     * @returns {Promise<Array>} Danh sách kết quả đã sắp xếp
     */
    async smartSearch(term) {
        if (!this.db || !term) return [];

        const cleanTerm = term.toLowerCase().trim();
        
        // Query sử dụng FTS5 với logic trọng số:
        // 1. Ưu tiên khớp chính xác (Exact Match)
        // 2. Ưu tiên từ có độ dài gần nhất với term
        // 3. Sử dụng BM25 Rank của FTS
        const sql = `
            SELECT 
                target_id, 
                type, 
                key,
                (key = ?) as is_exact
            FROM lookups_fts 
            WHERE key MATCH ? 
            ORDER BY 
                is_exact DESC, 
                abs(length(key) - length(?)) ASC,
                rank
            LIMIT 10
        `;

        try {
            // MATCH query trong FTS thường dùng cú pháp 'term*' để tìm prefix
            const results = await this.execute(sql, [cleanTerm, `${cleanTerm}*`, cleanTerm]);
            return results;
        } catch (error) {
            console.error("FTS Search Error:", error);
            return [];
        }
    },

    async search(term) {
        if (!this.db) return null;
        try {
            const lookupRes = await this._exec("SELECT target_id, type FROM lookups WHERE key = ?", [term]);
            if (!lookupRes.length || !lookupRes[0].values.length) return null;
            
            const [targetId, type] = lookupRes[0].values[0];
            
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

            if (type === 0) {
                const res = await this._exec("SELECT components FROM deconstructions WHERE id = ?", [targetId]);
                if (res.length && res[0].values.length > 0) result.definition = res[0].values[0][0];
            } 
            else if (type === 1) {
                const res = await this._exec(
                    "SELECT headword, definition_json, grammar_json, example_json FROM entries WHERE id = ?", 
                    [targetId]
                );
                if (res.length && res[0].values.length > 0) {
                    const row = res[0].values[0];
                    result.headword = row[0];
                    result.definition = row[1];
                    result.entry_grammar = row[2];
                    result.entry_example = row[3];
                }
            }
            else if (type === 2) {
                const res = await this._exec(
                    "SELECT root, definition_json FROM roots WHERE id = ?", 
                    [targetId]
                );
                if (res.length && res[0].values.length > 0) {
                    const row = res[0].values[0];
                    result.headword = row[0];
                    result.definition = row[1];
                }
            }

            const gnRes = await this._exec("SELECT grammar_json FROM grammar_notes WHERE key = ?", [term]);
            if (gnRes.length && gnRes[0].values.length > 0) {
                result.grammar_note = gnRes[0].values[0][0];
            }
            
            return result;

        } catch (e) {
            logger.error("Search", `Error searching for ${term}`, e);
            return null;
        }
    }
    
};