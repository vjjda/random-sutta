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
        if (chunkName.startsWith('structure/')) {
            return chunkName.split('/')[1];
        }
        return chunkName.replace(/_chunk_\d+$/, '_struct');
    }

    async fetchStructure(structName) {
        const cleanName = structName.replace(/^structure\//, '');
        if (this.structureCache.has(cleanName)) return this.structureCache.get(cleanName);
        const url = `assets/db/structure/${cleanName}.json`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.structureCache.set(cleanName, data);
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

    // [NEW] Hàm thông minh để lấy Meta cho một danh sách UID (dùng cho Branch View)
    // Nó sẽ tự động tải các Chunk cần thiết
    async fetchMetaForUids(uids) {
        await this.init();
        
        // 1. Gom nhóm UID theo Chunk để tải tối ưu
        const chunksToLoad = new Set();
        uids.forEach(uid => {
            const locator = this._getLocator(uid);
            // Chỉ tải nếu locator là chunk (không phải structure)
            if (locator && !locator.includes('_struct') && !locator.startsWith('structure')) {
                chunksToLoad.add(locator);
            }
        });

        // 2. Tải song song các Chunk
        const promises = Array.from(chunksToLoad).map(chunk => this.fetchContentChunk(chunk));
        await Promise.all(promises);

        // 3. Tổng hợp Meta từ cache
        const resultMeta = {};
        
        // Helper để lấy meta từ chunk cache
        const getMetaFromCache = (uid) => {
             const locator = this._getLocator(uid);
             if (!locator) return null;
             const chunkData = this.contentCache.get(locator);
             return chunkData && chunkData[uid] ? chunkData[uid].meta : null;
        };

        uids.forEach(uid => {
            resultMeta[uid] = getMetaFromCache(uid);
        });

        return resultMeta;
    }

    async getSutta(uid) {
        await this.init();
        const locator = this._getLocator(uid);
        if (!locator) return null;

        // CASE 1: BRANCH
        if (locator.includes('_struct') || locator.startsWith('structure/')) {
            const structData = await this.fetchStructure(locator);
            if (!structData) return null;
            return {
                uid: uid,
                isBranch: true,
                meta: structData.meta,
                bookStructure: structData.structure
            };
        }

        // CASE 2: LEAF
        const chunkName = locator;
        const structName = this._resolveStructureName(chunkName);

        const [structData, chunkData] = await Promise.all([
            this.fetchStructure(structName),
            this.fetchContentChunk(chunkName)
        ]);

        if (!structData || !chunkData) return null;

        const combinedMeta = { ...structData.meta };
        // Merge meta từ chunk hiện tại để support nav
        Object.keys(chunkData).forEach(key => {
            if (chunkData[key].meta) combinedMeta[key] = chunkData[key].meta;
        });

        let itemData = chunkData[uid]; 
        let myMeta = itemData ? itemData.meta : combinedMeta[uid];
        let targetContent = itemData ? itemData.content : null;

        if (myMeta && myMeta.type === 'shortcut') {
            const parentUid = myMeta.parent_uid;
            if (chunkData[parentUid]) {
                targetContent = chunkData[parentUid].content;
            }
        }

        return {
            uid: uid,
            isBranch: false,
            content: targetContent,
            meta: combinedMeta,
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