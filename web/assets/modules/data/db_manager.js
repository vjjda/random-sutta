// Path: web/assets/modules/data/db_manager.js
import { getLogger } from '../utils/logger.js'; 
import { PRIMARY_BOOKS } from './constants.js';

const logger = getLogger("DBManager");

// [OFFLINE SUPPORT]
window.__DB_LOADER__ = {
    cache: {},
    receive: function(key, data) {
        this.cache[key] = data;
    }
};

export const DB = {
    uidIndex: null,
    suttaCache: new Map(),

    async init() {
        if (this.uidIndex) return;

        if (window.__DB_INDEX__) {
            logger.info("Init", "Using Preloaded Index (Offline Mode)");
            this.uidIndex = window.__DB_INDEX__;
            return;
        }

        try {
            const resp = await fetch('assets/db/uid_index.json');
            if (!resp.ok) throw new Error(`Index fetch failed: ${resp.status}`);
            this.uidIndex = await resp.json();
            logger.info("Init", `Index loaded (${Object.keys(this.uidIndex.locator || {}).length} items)`);
        } catch (e) {
            logger.error("Init", "Failed to load index", e);
            throw e;
        }
    },

    getPool(bookId) {
        if (!this.uidIndex || !this.uidIndex.pools) return [];
        if (bookId === 'primary') {
            let combined = [];
            PRIMARY_BOOKS.forEach(bid => {
                const bookPool = this.uidIndex.pools.books[bid] || [];
                combined = combined.concat(bookPool);
            });
            return combined;
        }
        return this.uidIndex.pools.books[bookId] || [];
    },

    async _fetchResource(path, key) {
        if (window.__DB_LOADER__.cache[key]) {
            return window.__DB_LOADER__.cache[key];
        }
        const resp = await fetch(path);
        if (!resp.ok) throw new Error(`Resource 404: ${path}`);
        return await resp.json();
    },

    async getSutta(suttaId) {
        await this.init();

        if (this.suttaCache.has(suttaId)) {
            return this.suttaCache.get(suttaId);
        }

        const locatorKey = this.uidIndex.locator[suttaId];
        if (!locatorKey) {
            logger.warn("getSutta", `Locator not found for ${suttaId}`);
            return null;
        }

        const isStructure = locatorKey.includes("_struct");
        // [FIX] Sửa lại logic path để khớp với prefix 'content/' hoặc 'structure/' có trong locator
        const path = `assets/db/${locatorKey}.js`.replace('.js', '.json'); 
        const resourceKey = locatorKey.split('/').pop();

        try {
            const chunkData = await this._fetchResource(path, resourceKey);
            let suttaData = chunkData[suttaId];

            if (!suttaData) {
                logger.warn("getSutta", `Key ${suttaId} missing in chunk ${resourceKey}`);
                return null;
            }

            // Xử lý Shortcut
            if (suttaData.meta && suttaData.meta.type === 'shortcut') {
                const parentId = suttaData.meta.parent_uid;
                const parentData = chunkData[parentId];
                if (parentData) {
                    suttaData = {
                        ...parentData,
                        meta: { ...parentData.meta, ...suttaData.meta },
                        uid: suttaId
                    };
                }
            }

            // [FIX] Logic tải Book Structure cho Leaf
            let bookStructure = suttaData.bookStructure || null;

            if (isStructure) {
                bookStructure = chunkData.structure;
                suttaData.isBranch = true;
            } else if (!bookStructure) {
                // Tự động tìm Structure của sách chứa bài kinh này
                const bookId = suttaId.match(/^[a-z]+/)[0]; // vd: iti80 -> iti
                const structLocator = this.uidIndex.locator[bookId];
                
                if (structLocator) {
                    try {
                        // structLocator vd: "structure/sutta_kn_iti_iti_struct"
                        // Cần load file này để lấy cây cấu trúc (structure)
                        const structKey = structLocator.split('/').pop();
                        const structPath = `assets/db/${structLocator}.json`;
                        const structData = await this._fetchResource(structPath, structKey);
                        if (structData && structData.structure) {
                            bookStructure = structData.structure;
                        }
                    } catch (err) {
                        logger.warn("getSutta", `Failed to load structure for book ${bookId}`);
                    }
                }
            }
            
            // [FIX] Trả về meta dạng MAP { [id]: meta } để Renderer tra cứu được
            const metaMap = {};
            if (suttaData.meta) {
                metaMap[suttaId] = suttaData.meta;
            }

            const result = {
                uid: suttaId,
                content: suttaData.content || null,
                meta: metaMap, // Map thay vì object đơn lẻ
                isBranch: !!suttaData.isBranch,
                bookStructure: bookStructure
            };

            this.suttaCache.set(suttaId, result);
            return result;

        } catch (e) {
            logger.error("getSutta", `Failed to load ${suttaId}`, e);
            return null;
        }
    },

    async fetchMetaForUids(uids) {
        await this.init();
        const result = {};
        const chunksToLoad = new Set();
        const uidToChunk = {};

        uids.forEach(uid => {
            const loc = this.uidIndex.locator[uid];
            if (loc) {
                chunksToLoad.add(loc);
                uidToChunk[uid] = loc;
            }
        });

        const promises = Array.from(chunksToLoad).map(async (loc) => {
            const path = `assets/db/${loc}.json`;
            const key = loc.split('/').pop();
            try {
                const data = await this._fetchResource(path, key);
                return { key: loc, data };
            } catch (e) {
                return { key: loc, data: {} };
            }
        });

        const loadedChunks = await Promise.all(promises);
        const chunkMap = {};
        loadedChunks.forEach(item => chunkMap[item.key] = item.data);

        uids.forEach(uid => {
            const loc = uidToChunk[uid];
            // Lưu ý: Chunk content chứa { content:..., meta:... }, còn Chunk struct chứa { meta: { id: ... } }
            // Cần check kỹ cấu trúc
            if (loc && chunkMap[loc]) {
                const source = chunkMap[loc];
                // Case 1: Structure file (meta nằm trong key 'meta')
                if (source.meta && source.meta[uid]) {
                    result[uid] = source.meta[uid];
                } 
                // Case 2: Content Chunk (meta nằm trong object của uid)
                else if (source[uid] && source[uid].meta) {
                    result[uid] = source[uid].meta;
                }
            }
        });

        return result;
    },

    async fetchStructure(key) {
        // key chỉ là filename (ko path), nhưng logic _fetchResource cần path nếu online
        // Hàm này ít dùng trực tiếp, chủ yếu dùng nội bộ getSutta
        return null; 
    },

    async downloadAll(onProgress) {
        await this.init();
        const allLocators = new Set(Object.values(this.uidIndex.locator));
        allLocators.add("structure/super_struct");

        const total = allLocators.size;
        let current = 0;
        const items = Array.from(allLocators);
        const batchSize = 5;
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            await Promise.all(batch.map(async (loc) => {
                const path = `assets/db/${loc}.json`;
                try { await fetch(path); } catch (e) {}
            }));
            current += batch.length;
            if (onProgress) onProgress(Math.min(current, total), total);
        }
    }
};