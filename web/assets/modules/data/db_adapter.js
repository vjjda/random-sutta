// Path: web/assets/modules/data/db_adapter.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("DbAdapter");
const DB_NAME = "SuttaDB";
const DB_VERSION = 1;
const STORE_CONTENT = "content";
const STORE_META = "meta";

export const DbAdapter = {
    _db: null,

    async init() {
        if (this._db) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_CONTENT)) {
                    db.createObjectStore(STORE_CONTENT); // Key: chunk_id (e.g., mn_chunk_0)
                }
                if (!db.objectStoreNames.contains(STORE_META)) {
                    db.createObjectStore(STORE_META); // Key: book_id (e.g., mn)
                }
            };

            request.onsuccess = (e) => {
                this._db = e.target.result;
                logger.info("Init", "IndexedDB connected.");
                resolve();
            };

            request.onerror = (e) => {
                logger.error("Init", "Failed to open DB", e);
                reject(e);
            };
        });
    },

    async get(storeName, key) {
        return this._runTx(storeName, 'readonly', store => store.get(key));
    },

    async set(storeName, key, val) {
        return this._runTx(storeName, 'readwrite', store => store.put(val, key));
    },

    /**
     * Chạy transaction an toàn với Promise
     */
    _runTx(storeName, mode, op) {
        return new Promise((resolve, reject) => {
            if (!this._db) return reject("DB not initialized");
            try {
                const tx = this._db.transaction(storeName, mode);
                const store = tx.objectStore(storeName);
                const req = op(store);

                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            } catch (e) {
                reject(e);
            }
        });
    }
};