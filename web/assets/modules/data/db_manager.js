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

    _resolveStructureName(locator) {
        // [FIXED] Nếu locator bắt đầu bằng "structure/", đó chính là tên file struct
        if (locator.startsWith('structure/')) {
            return locator.split('/')[1]; // Lấy phần sau dấu gạch chéo (ví dụ: super_struct)
        }
        // Logic cũ cho chunk
        return locator.replace(/_chunk_\d+$/, '_struct');
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
        
        const locator = this._getLocator(uid);
        if (!locator) return null;

        // --- CASE 1: BRANCH (Super hoặc Book Root) ---
        // Locator dạng "structure/..." hoặc "structure" (legacy)
        if (locator.startsWith('structure')) {
            const structName = this._resolveStructureName(locator);
            const structData = await this.fetchStructure(structName);
            
            if (!structData) return null;
            
            return {
                uid: uid,
                isBranch: true,
                meta: structData.meta,
                bookStructure: structData.structure
            };
        }

        // --- CASE 2: LEAF / SHORTCUT ---
        const chunkName = locator;
        const structName = this._resolveStructureName(chunkName);

        const [structData, chunkData] = await Promise.all([
            this.fetchStructure(structName),
            this.fetchContentChunk(chunkName)
        ]);

        if (!structData || !chunkData) return null;

        const combinedMeta = { ...structData.meta };
        if (chunkData) {
            Object.keys(chunkData).forEach(key => {
                if (chunkData[key].meta) combinedMeta[key] = chunkData[key].meta;
            });
        }

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