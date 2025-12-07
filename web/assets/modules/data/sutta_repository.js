// Path: web/assets/modules/data/sutta_repository.js
import { getLogger } from '../utils/logger.js';
import { IODriver } from './io_driver.js';
import { PRIMARY_BOOKS } from './constants.js';
import { OfflineSyncer } from './offline_syncer.js';

const logger = getLogger("SuttaRepo");

export const SuttaRepository = {
    uidIndex: null,
    suttaCache: new Map(),

    async init() {
        if (this.uidIndex) return;

        // Ưu tiên Index được inject sẵn (Offline Mode)
        if (window.__DB_INDEX__) {
            this.uidIndex = window.__DB_INDEX__;
            logger.info("init", "Loaded Offline Index");
            return;
        }

        // Fetch Online Index
        try {
            this.uidIndex = await IODriver.fetchResource('assets/db/uid_index.json', 'uid_index');
            logger.info("init", "Loaded Online Index");
        } catch (e) {
            logger.error("init", "Index load failed", e);
        }
    },

    getPool(bookId) {
        if (!this.uidIndex) return [];
        if (bookId === 'primary') {
            let combined = [];
            PRIMARY_BOOKS.forEach(bid => {
                const pool = this.uidIndex.pools.books[bid] || [];
                combined = combined.concat(pool);
            });
            return combined;
        }
        return this.uidIndex.pools.books[bookId] || [];
    },

    async getSutta(suttaId) {
        await this.init();
        if (this.suttaCache.has(suttaId)) return this.suttaCache.get(suttaId);

        const locatorKey = this.uidIndex.locator[suttaId];
        if (!locatorKey) {
            logger.warn("getSutta", `Locator not found: ${suttaId}`);
            return null;
        }

        const isStructure = locatorKey.includes("_struct");
        const path = `assets/db/${locatorKey}.json`;
        const resourceKey = locatorKey.split('/').pop(); // Tên file cho cache key

        try {
            const chunkData = await IODriver.fetchResource(path, resourceKey);
            let suttaData = chunkData[suttaId];
            if (!suttaData) return null;

            // 1. Xử lý Shortcut (Merge với cha)
            if (suttaData.meta?.type === 'shortcut') {
                const parent = chunkData[suttaData.meta.parent_uid];
                if (parent) {
                    suttaData = { 
                        ...parent, 
                        meta: { ...parent.meta, ...suttaData.meta }, 
                        uid: suttaId 
                    };
                }
            }

            // 2. Xử lý Structure (Book Tree)
            let bookStructure = suttaData.bookStructure || null;
            if (isStructure) {
                bookStructure = chunkData.structure;
                suttaData.isBranch = true;
            } else if (!bookStructure) {
                // Auto-load structure cho Leaf để phục vụ Navigation
                const bookId = suttaId.match(/^[a-z]+/)[0];
                const structLoc = this.uidIndex.locator[bookId];
                if (structLoc) {
                    const sKey = structLoc.split('/').pop();
                    const sData = await IODriver.fetchResource(`assets/db/${structLoc}.json`, sKey);
                    bookStructure = sData?.structure;
                }
            }

            // 3. Chuẩn hóa Output
            const result = {
                uid: suttaId,
                content: suttaData.content || null,
                meta: { [suttaId]: suttaData.meta }, // Trả về dạng Map cho Renderer
                isBranch: !!suttaData.isBranch,
                bookStructure
            };

            this.suttaCache.set(suttaId, result);
            return result;
        } catch (e) {
            logger.error("getSutta", `Failed ${suttaId}`, e);
            return null;
        }
    },

    /**
     * Lấy Metadata cho một danh sách UID (Dùng cho Nav Title, Branch List)
     */
    async fetchMetaList(uids) {
        await this.init();
        const result = {};
        const chunksToLoad = new Set();
        const uidToChunk = {};

        // Map UID -> Chunk Locator
        uids.forEach(uid => {
            const loc = this.uidIndex.locator[uid];
            if (loc) {
                chunksToLoad.add(loc);
                uidToChunk[uid] = loc;
            }
        });

        // Parallel Fetch
        const promises = Array.from(chunksToLoad).map(async (loc) => {
            const path = `assets/db/${loc}.json`;
            const key = loc.split('/').pop();
            try {
                const data = await IODriver.fetchResource(path, key);
                return { key: loc, data };
            } catch (e) {
                return { key: loc, data: {} };
            }
        });

        const loadedChunks = await Promise.all(promises);
        const chunkMap = {};
        loadedChunks.forEach(item => chunkMap[item.key] = item.data);

        // Extract Meta
        uids.forEach(uid => {
            const loc = uidToChunk[uid];
            const source = chunkMap[loc];
            if (source) {
                if (source.meta && source.meta[uid]) {
                    result[uid] = source.meta[uid]; // Structure Chunk
                } else if (source[uid] && source[uid].meta) {
                    result[uid] = source[uid].meta; // Content Chunk
                }
            }
        });

        return result;
    },
    
    // Support Service: Get Raw Structure (cho Escalation Nav)
    async fetchStructureData(key) {
        const loc = `structure/${key}`;
        const path = `assets/db/${loc}.json`;
        try {
            return await IODriver.fetchResource(path, key);
        } catch (e) { return null; }
    },

    async downloadAll(onProgress) {
        await this.init();
        return OfflineSyncer.downloadAll(this.uidIndex, onProgress);
    }
};