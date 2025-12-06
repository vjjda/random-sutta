// Path: web/assets/modules/data/db_manager.js
import { getLogger } from '../shared/logger.js';
import { PRIMARY_BOOKS } from './constants.js';

const logger = getLogger("DB");

class DatabaseManager {
    constructor() {
        this.index = null;
        this.structureCache = new Map();
        this.contentCache = new Map();
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        try {
            const response = await fetch('assets/db/uid_index.json');
            if (!response.ok) throw new Error("Could not load uid_index.json");
            this.index = await response.json();
            this.isInitialized = true;
        } catch (e) {
            logger.error("init", "Critical: Failed to load DB Index", e);
            throw e;
        }
    }

    _getLocator(uid) {
        return this.index.locator[uid];
    }

    _resolveStructureName(chunkName) {
        return chunkName.replace(/_chunk_\d+$/, '_struct');
    }

    async fetchStructure(structName) {
        if (this.structureCache.has(structName)) return this.structureCache.get(structName);
        const url = `assets/db/structure/${structName}.json`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.structureCache.set(structName, data);
            return data;
        } catch (e) {
            logger.error("fetchStructure", `Failed to load ${structName}`, e);
            return null;
        }
    }

    async fetchContentChunk(chunkName) {
        if (this.contentCache.has(chunkName)) return this.contentCache.get(chunkName);
        const url = `assets/db/content/${chunkName}.json`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.contentCache.set(chunkName, data);
            return data;
        } catch (e) {
            logger.error("fetchChunk", `Failed to load ${chunkName}`, e);
            return null;
        }
    }

    async getSutta(uid) {
        await this.init();
        
        const chunkName = this._getLocator(uid);
        if (!chunkName || chunkName === 'structure') {
            return null;
        }

        const structName = this._resolveStructureName(chunkName);

        const [structData, chunkData] = await Promise.all([
            this.fetchStructure(structName),
            this.fetchContentChunk(chunkName)
        ]);

        if (!structData || !chunkData) return null;

        // --- [CRITICAL FIX] ---
        // 1. Khởi tạo Meta Map với dữ liệu Branch từ Structure
        const combinedMeta = { ...structData.meta };

        // 2. Gộp TOÀN BỘ Meta từ Chunk hiện tại vào Meta Map
        // Điều này giúp UI tìm thấy Title của các bài kinh lân cận (Next/Prev)
        if (chunkData) {
            Object.keys(chunkData).forEach(key => {
                const item = chunkData[key];
                if (item.meta) {
                    combinedMeta[key] = item.meta;
                }
            });
        }
        // ----------------------

        let itemData = chunkData[uid]; 
        let myMeta = itemData ? itemData.meta : combinedMeta[uid];

        let targetContent = itemData ? itemData.content : null;
        if (myMeta && myMeta.type === 'shortcut') {
            const parentUid = myMeta.parent_uid;
            // Tìm content cha (thường cũng nằm trong chunk này)
            if (chunkData[parentUid]) {
                targetContent = chunkData[parentUid].content;
            }
        }

        return {
            uid: uid,
            content: targetContent,
            meta: combinedMeta, // Đã chứa đầy đủ meta của hàng xóm
            bookStructure: structData.structure
        };
    }

    getPool(type = 'primary') {
        if (!this.index) return [];
        if (type === 'primary') {
            let pool = [];
            PRIMARY_BOOKS.forEach(bookId => {
                const bookPool = this.index.pools.books[bookId];
                if (bookPool) pool = pool.concat(bookPool);
            });
            return pool;
        } else {
            return this.index.pools.books[type] || [];
        }
    }
}

export const DB = new DatabaseManager();