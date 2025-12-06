// Path: web/assets/modules/data/db_manager.js
import { getLogger } from '../shared/logger.js';
import { PRIMARY_BOOKS } from './constants.js';

const logger = getLogger("DB");

class DatabaseManager {
    // ... (Giữ nguyên constructor, init, _getLocator, _resolveStructureName, fetchStructure) ...
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
        // [FIX] Thêm Promise cache để tránh race condition (gọi nhiều lần cùng 1 file)
        if (this.contentCache.has(chunkName)) return this.contentCache.get(chunkName);
        
        // Kiểm tra xem có đang fetch dở không (pending promise)
        if (this._pendingFetches && this._pendingFetches[chunkName]) {
            return this._pendingFetches[chunkName];
        }
        if (!this._pendingFetches) this._pendingFetches = {};

        const url = `assets/db/content/${chunkName}.json`;
        
        const fetchPromise = fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                this.contentCache.set(chunkName, data);
                delete this._pendingFetches[chunkName];
                return data;
            })
            .catch(e => {
                logger.error("fetchChunk", `Failed to load ${chunkName}`, e);
                delete this._pendingFetches[chunkName];
                return null;
            });
            
        this._pendingFetches[chunkName] = fetchPromise;
        return fetchPromise;
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

        if (chunksToLoad.size > 0) {
            logger.debug("fetchMeta", `Loading ${chunksToLoad.size} chunks for branch view...`);
            const promises = Array.from(chunksToLoad).map(chunk => this.fetchContentChunk(chunk));
            await Promise.all(promises);
        }

        const resultMeta = {};
        uids.forEach(uid => {
            const locator = this._getLocator(uid);
            if (locator) {
                const chunkData = this.contentCache.get(locator);
                if (chunkData && chunkData[uid]) {
                    resultMeta[uid] = chunkData[uid].meta;
                }
            }
        });

        return resultMeta;
    }

    // ... (Giữ nguyên getSutta, getPool, downloadAll) ...
    async getSutta(uid) {
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

    async downloadAll(onProgress) {
        await this.init();
        const contentChunks = new Set();
        const structureFiles = new Set();
        
        Object.values(this.index.locator).forEach(loc => {
            if (loc.includes('_struct') || loc.startsWith('structure/')) {
                const clean = loc.replace(/^structure\//, '');
                structureFiles.add(clean);
            } else {
                contentChunks.add(loc);
                const structName = this._resolveStructureName(loc);
                structureFiles.add(structName);
            }
        });

        const totalFiles = contentChunks.size + structureFiles.size;
        let downloaded = 0;

        const fetchQueue = async (urls, type) => {
            for (const name of urls) {
                try {
                    if (type === 'struct') await this.fetchStructure(name);
                    else await this.fetchContentChunk(name);
                    downloaded++;
                    if (onProgress) onProgress(downloaded, totalFiles);
                } catch (e) {
                    console.warn(`Download failed: ${name}`);
                }
            }
        };

        await fetchQueue(Array.from(structureFiles), 'struct');
        await fetchQueue(Array.from(contentChunks), 'content');
        return true;
    }
}

export const DB = new DatabaseManager();