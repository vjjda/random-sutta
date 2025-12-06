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
        if (!chunkName) return null;

        const structName = this._resolveStructureName(chunkName);

        const [structData, chunkData] = await Promise.all([
            this.fetchStructure(structName),
            this.fetchContentChunk(chunkName)
        ]);

        if (!structData || !chunkData) return null;

        let targetContent = chunkData[uid];
        // Lấy meta của CHÍNH bài này để check shortcut
        let myMeta = structData.meta[uid]; 

        if (!targetContent && myMeta && myMeta.type === 'shortcut') {
            targetContent = chunkData[myMeta.parent_uid];
        }

        return {
            uid: uid,
            content: targetContent,
            // [QUAN TRỌNG] Trả về TOÀN BỘ meta của sách để UI tra cứu title của prev/next
            meta: structData.meta, 
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