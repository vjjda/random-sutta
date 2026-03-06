// Path: web/assets/modules/data/db_adapter.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("DbAdapter");
const DB_NAME = "SuttaDB";
const DB_VERSION = 1;
const STORE_CONTENT = "content";
const STORE_META = "meta";

export const DbAdapter = {
    _db: null,
    _memoryCache: { meta: {}, content: {} }, // [NEW] Cache cho chế độ Offline/File
    _isMemoryMode: false,

    async init() {
        // [NEW] Setup JSON-P Loader cho chế độ Offline (file://)
        // Hệ thống build Python sẽ convert JSON -> JS gọi hàm này
        window.__DB_LOADER__ = {
            receive: (key, data) => {
                // Xác định loại dữ liệu dựa trên key hoặc cấu trúc
                // Convention: meta key thường ngắn (mn, dn), content key dài (mn_chunk_0)
                const store = key.includes("_chunk_") ? "content" : "meta";
                this._memoryCache[store][key] = data;
                // logger.debug("MemoryDB", `Received ${key}`);
            }
        };

        // Kiểm tra protocol để bật chế độ Memory Mode ưu tiên
        if (window.location.protocol === 'file:') {
            this._isMemoryMode = true;
            logger.info("Init", "Running in File Protocol (Memory Mode). IndexedDB disabled.");
            return;
        }

        // Init IndexedDB như bình thường cho chế độ Online/HTTP
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_CONTENT)) db.createObjectStore(STORE_CONTENT);
                if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
            };

            request.onsuccess = (e) => {
                this._db = e.target.result;
                logger.info("Init", "IndexedDB connected.");
                resolve();
            };

            request.onerror = (e) => {
                logger.warn("Init", "IDB Failed (Private Mode?), falling back to Memory", e);
                this._isMemoryMode = true; // Fallback nếu không mở được DB
                resolve();
            };
        });
    },

    async get(storeName, key) {
        // 1. Check Memory Cache (Ưu tiên số 1 cho Offline Build)
        if (this._memoryCache[storeName] && this._memoryCache[storeName][key]) {
            return this._memoryCache[storeName][key];
        }

        // 2. Check IndexedDB
        if (this._isMemoryMode || !this._db) return null;
        return this._runTx(storeName, 'readonly', store => store.get(key));
    },

    async set(storeName, key, val) {
        // 1. Write Memory
        if (!this._memoryCache[storeName]) this._memoryCache[storeName] = {};
        this._memoryCache[storeName][key] = val;

        // 2. Write IndexedDB
        if (this._isMemoryMode || !this._db) return;
        return this._runTx(storeName, 'readwrite', store => store.put(val, key));
    },

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