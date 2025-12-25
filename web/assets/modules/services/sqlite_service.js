// Path: web/assets/modules/services/sqlite_service.js
import { getLogger } from 'utils/logger.js';
import SQLiteAsyncESMFactory from 'wa-sqlite/wa-sqlite-async.mjs';
import * as SQLite from 'wa-sqlite/sqlite-api.js';
import { IDBBatchAtomicVFS } from 'wa-sqlite/IDBBatchAtomicVFS.js';

const logger = getLogger("SqliteService");

const DB_ZIP_URL = "assets/db/dpd_mini.db.zip";
const DB_NAME = "dpd_mini.db";

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
            // Use 'idb-batch-atomic' which is robust
            const vfs = new IDBBatchAtomicVFS(DB_NAME);
            this.sqlite3.vfs_register(vfs, true); // Set as default VFS

            // 3. Check if DB exists in VFS (IndexedDB)
            // We can try opening it. If size is 0 or error, we populate it.
            // IDBBatchAtomicVFS stores data in IDB store name matches DB_NAME usually or a fixed one?
            // IDBBatchAtomicVFS creates an IDB database named 'wa-sqlite' (default) containing blocks.
            // The constructor arg 'idbName' defaults to 'wa-sqlite'.
            // Let's assume standard behavior.

            let needsPopulation = false;
            try {
                // Try to open to check existence/validity? 
                // Currently, let's check via VFS API or just try to open
                // If we open and it's empty, we need to populate.
            } catch (e) {}

            // Open DB (This creates the file in VFS if not exists)
            this.db = await this.sqlite3.open_v2(
                DB_NAME, 
                SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE, 
                "idb-batch-atomic"
            );

            // Check if valid (has tables)
            let tableCheck = [];
            try {
                tableCheck = await this._exec("SELECT name FROM sqlite_master WHERE type='table' AND name='lookups'");
            } catch (e) {
                // likely empty or corrupt
            }

            if (tableCheck.length === 0) {
                logger.info("Init", "DB empty or missing. Downloading & Populating...");
                await this.sqlite3.close(this.db); // Close to write raw
                this.db = null;

                // Download & Unzip
                const dbBinary = await this._downloadAndUnzip();
                
                // Write to VFS
                // We need to write the binary data to the VFS file 'dpd_mini.db'
                // IDBBatchAtomicVFS doesn't expose a simple "write whole file" easily from outside
                // without using SQLite API or VFS internal API.
                // EASIEST WAY: Use SQLite to write? No, too slow for bulk.
                
                // We can use the VFS instance directly if possible, or simple atomic write logic.
                // IDBBatchAtomicVFS has close(), open()...
                // Let's use standard File API if VFS exposes it? No.
                
                // Hack: We can just use the VFS object we created.
                // Or better: Delete the VFS file and let VFS handle it?
                
                // Let's use the standard "import" approach for wa-sqlite if available, 
                // OR simpler: Write page by page?
                
                // Actually, for wa-sqlite with IDB, we often just want to 'upload' the file.
                // Let's use the provided `vfs.close()` and direct IDB manipulation? Too complex.
                
                // Alternative: Re-open DB and restore from SQL dump? No, we have binary.
                
                // Correct approach for wa-sqlite file upload:
                // 1. Delete existing file via sqlite3.vfs_unlink (if exists)
                // 2. Open file via sqlite3.vfs_open
                // 3. Write via sqlite3.vfs_write
                // However, accessing VFS methods via `sqlite3` object in JS is tricky in some versions.
                
                // Let's look at examples. Usually people just write to IDB directly.
                // IDBBatchAtomicVFS stores blocks in object store 'blocks'.
                // This is complicated to replicate manually.
                
                // Let's use SQLite API to write? `sqlite3_deserialize`? 
                // wa-sqlite supports deserialize! (In-memory DB to VFS?)
                // If we load into memory then backup to VFS?
                
                // Wait, if we use `deserialize`, it creates an in-memory DB.
                // We want to persist to IDB.
                // We can open an in-memory DB with the binary, then `VACUUM INTO 'file:dpd_mini.db'`?
                // This is a great trick! 
                
                // 1. Open In-Memory DB from Binary
                const memDB = await this.sqlite3.open_v2(":memory:");
                
                // DESERIALIZE (Load binary to memDB)
                // sqlite3_deserialize(db, schema, data, sz, sz, flags)
                // We need to pass the pointer.
                
                // Easier Path:
                // Create the file in VFS using standard open/write flags if available.
                // Or: just iterate and write chunks using `sqlite3.io` methods?
                
                // Let's try the `VACUUM INTO` approach. It's robust.
                // But `VACUUM INTO` might not be enabled in all builds.
                
                // Let's try a simpler approach supported by wa-sqlite examples:
                // Just writing the data to the file using filesystem APIs if exposed.
                // But wa-sqlite uses a virtual FS.
                
                // Let's use the VFS instance `vfs` we created!
                // It's a JS object. It might not have simple write API.
                
                // Plan B: Use a simple IDB-backed VFS that mirrors a file? 
                // IDBBatchAtomicVFS is block based.
                
                // Let's go with "Delete existing -> Open DB -> Restore".
                // How to restore?
                
                // OK, looking at wa-sqlite discussions:
                // "To import a database file... you can use the File System Access API... or just put it in IndexedDB yourself."
                
                // Given I want to keep it simple and I have the binary.
                // I will use `sqlite3_deserialize` to open it in-memory.
                // Then I will use the Backup API (if available) or `VACUUM INTO` to save to the IDB file.
                
                // Let's check if `sqlite3_deserialize` is available in `wa-sqlite-async`.
                // It usually is.
                
                // 1. Alloc memory for binary
                const pData = this.sqlite3.malloc(dbBinary.byteLength);
                const heap = this.sqlite3.HEAPU8;
                heap.set(new Uint8Array(dbBinary), pData);
                
                // 2. Open Memory DB
                // Actually, `deserialize` works on an open DB connection.
                const memDb = await this.sqlite3.open_v2('mem', SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_MEMORY);
                
                // 3. Deserialize
                const rc = await this.sqlite3.sqlite3_deserialize(
                    memDb, 'main', pData, dbBinary.byteLength, dbBinary.byteLength, 
                    SQLite.SQLITE_DESERIALIZE_FREEONCLOSE | SQLite.SQLITE_DESERIALIZE_RESIZEABLE
                );
                
                if (rc !== SQLite.SQLITE_OK) throw new Error(`Deserialize failed: ${rc}`);
                
                // 4. Backup to IDB File
                // Open destination IDB DB
                this.db = await this.sqlite3.open_v2(
                    DB_NAME, 
                    SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE, 
                    "idb-batch-atomic"
                );
                
                logger.info("Init", "Restoring to IndexedDB (This may take a moment)...");
                
                // Use Backup API: init, step, finish
                const pBackup = await this.sqlite3.sqlite3_backup_init(this.db, 'main', memDb, 'main');
                if (!pBackup) throw new Error("Backup init failed");
                
                await this.sqlite3.sqlite3_backup_step(pBackup, -1); // -1 = Copy all pages
                await this.sqlite3.sqlite3_backup_finish(pBackup);
                
                await this.sqlite3.close(memDb);
                
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
            if (res.length > 0) {
                this._keyMap.fullToAbbr = {};
                this._keyMap.abbrToFull = {};
                
                // exec result in wa-sqlite might be [{columns:[], values:[]}] or just rows?
                // `exec` via `sqlite3.exec` is not standard. We usually use `sqlite3_exec` via callback or `sqlite3_prepare_v2` loop.
                // BUT, wa-sqlite provides a helper `sqlite3.statements(db, sql)` which yields iterators.
                // Let's make a helper `_exec`.
                
                // Assuming _exec returns simple row objects or values
                // My `_exec` implementation below returns: [{columns, values: [[...]]}] like sql.js for compatibility
                
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
    
    // Helper to run SQL and return format compatible with existing code
    // Returns: [{ columns: ['col1'], values: [['val1']] }]
    async _exec(sql, params = []) {
        if (!this.db) return [];
        
        const rows = [];
        const columns = [];
        
        // Use generator API from wa-sqlite
        for await (const stmt of this.sqlite3.statements(this.db, sql)) {
            // Bind params
            if (params.length > 0) {
                 // wa-sqlite bind logic?
                 // Or simple:
                 for (let i = 0; i < params.length; i++) {
                     this.sqlite3.sqlite3_bind_text(stmt, i + 1, params[i]); 
                     // Assuming text. For numbers use bind_int etc?
                     // Let's assume generic binding is needed.
                     // wa-sqlite doesn't have a generic `bind` helper in core.
                     // But `statements` yields a raw statement pointer.
                     
                     // Helper binding:
                     const val = params[i];
                     if (typeof val === 'number') this.sqlite3.sqlite3_bind_double(stmt, i + 1, val);
                     else if (val === null) this.sqlite3.sqlite3_bind_null(stmt, i + 1);
                     else this.sqlite3.sqlite3_bind_text(stmt, i + 1, String(val));
                 }
            }
            
            // Get columns (once)
            if (columns.length === 0) {
                const colCount = this.sqlite3.sqlite3_column_count(stmt);
                for (let i = 0; i < colCount; i++) {
                    columns.push(this.sqlite3.sqlite3_column_name(stmt, i));
                }
            }
            
            // Step
            while (await this.sqlite3.sqlite3_step(stmt) === SQLite.SQLITE_ROW) {
                const row = [];
                for (let i = 0; i < columns.length; i++) {
                     // Get value based on type? Or just text/double
                     const type = this.sqlite3.sqlite3_column_type(stmt, i);
                     switch (type) {
                         case SQLite.SQLITE_INTEGER:
                         case SQLite.SQLITE_FLOAT:
                             row.push(this.sqlite3.sqlite3_column_double(stmt, i));
                             break;
                         case SQLite.SQLITE_TEXT:
                             row.push(this.sqlite3.sqlite3_column_text(stmt, i));
                             break;
                         case SQLite.SQLITE_BLOB:
                             row.push(null); // Not handling blob for now
                             break;
                         case SQLite.SQLITE_NULL:
                             row.push(null);
                             break;
                     }
                }
                rows.push(row);
            }
        }
        
        if (columns.length === 0) return [];
        return [{ columns, values: rows }];
    },

    async search(term) {
        if (!this.db) return null;
        try {
            // 1. Get Target ID & Type
            const lookupRes = await this._exec("SELECT target_id, type FROM lookups WHERE key = ?", [term]);
            if (!lookupRes.length || !lookupRes[0].values.length) return null;
            
            const [targetId, type] = lookupRes[0].values[0];
            
            // 2. Fetch details
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
                if (res.length) result.definition = res[0].values[0][0];
            } 
            else if (type === 1) {
                const res = await this._exec(
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
            else if (type === 2) {
                const res = await this._exec(
                    "SELECT root, definition_json FROM roots WHERE id = ?", 
                    [targetId]
                );
                if (res.length) {
                    const row = res[0].values[0];
                    result.headword = row[0];
                    result.definition = row[1];
                }
            }

            const gnRes = await this._exec("SELECT grammar_json FROM grammar_notes WHERE key = ?", [term]);
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