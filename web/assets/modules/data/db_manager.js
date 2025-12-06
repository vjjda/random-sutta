// Path: web/assets/modules/data/db_manager.js
import { getLogger } from '../shared/logger.js';
import { PRIMARY_BOOKS } from './constants.js';

const logger = getLogger("DB");

class DatabaseManager {
    // ... (Các hàm constructor, init, fetch... giữ nguyên) ...
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

    async fetchMetaForUids(uids) {
        await this.init();
        const chunksToLoad = new Set();
        uids.forEach(uid => {
            const locator = this._getLocator(uid);
            if (locator && !locator.includes('_struct') && !locator.startsWith('structure')) {
                chunksToLoad.add(locator);
            }
        });

        const promises = Array.from(chunksToLoad).map(chunk => this.fetchContentChunk(chunk));
        await Promise.all(promises);

        const resultMeta = {};
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
        // ... (Giữ nguyên code cũ) ...
        await this.init();
        const locator = this._getLocator(uid);
        if (!locator) return null;

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

        const chunkName = locator;
        const structName = this._resolveStructureName(chunkName);

        const [structData, chunkData] = await Promise.all([
            this.fetchStructure(structName),
            this.fetchContentChunk(chunkName)
        ]);

        if (!structData || !chunkData) return null;

        const combinedMeta = { ...structData.meta };
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
        // ... (Giữ nguyên) ...
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

    // [NEW FEATURE] Download All for Offline
    // Trả về Progress Callback để update UI
    async downloadAll(onProgress) {
        await this.init();
        
        // 1. Thu thập danh sách file duy nhất cần tải
        const contentChunks = new Set();
        const structureFiles = new Set();
        
        // Duyệt qua tất cả Locator trong Index
        Object.values(this.index.locator).forEach(loc => {
            if (loc.includes('_struct') || loc.startsWith('structure/')) {
                // Đây là structure file locator, nhưng nó có thể ở dạng 'structure/super_struct'
                // hoặc 'sutta_mn_struct'. Cần chuẩn hóa.
                const clean = loc.replace(/^structure\//, '');
                structureFiles.add(clean);
            } else {
                // Đây là Chunk
                contentChunks.add(loc);
                // Mỗi Chunk thuộc về 1 Structure, nên add structure tương ứng luôn
                const structName = this._resolveStructureName(loc);
                structureFiles.add(structName);
            }
        });

        const totalFiles = contentChunks.size + structureFiles.size;
        let downloaded = 0;
        logger.info("downloadAll", `Start pre-fetching ${totalFiles} files...`);

        // Helper tải tuần tự để tránh nghẽn
        const fetchQueue = async (urls, type) => {
            for (const name of urls) {
                try {
                    if (type === 'struct') await this.fetchStructure(name);
                    else await this.fetchContentChunk(name);
                    
                    downloaded++;
                    if (onProgress) onProgress(downloaded, totalFiles);
                    
                } catch (e) {
                    logger.warn("downloadAll", `Failed to fetch ${name}`, e);
                }
            }
        };

        // Chạy tải
        await fetchQueue(Array.from(structureFiles), 'struct');
        await fetchQueue(Array.from(contentChunks), 'content');
        
        logger.info("downloadAll", "✅ Offline Download Completed.");
        return true;
    }
}

export const DB = new DatabaseManager();