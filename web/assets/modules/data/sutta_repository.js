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
        if (window.__DB_INDEX__) {
            this.uidIndex = window.__DB_INDEX__;
            return;
        }
        try {
            this.uidIndex = await IODriver.fetchResource('assets/db/uid_index.json', 'uid_index');
        } catch (e) {
            logger.error("init", "Index load failed", e);
        }
    },

    getPool(bookId) {
        if (!this.uidIndex) return [];
        if (bookId === 'primary') {
            return PRIMARY_BOOKS.flatMap(bid => this.uidIndex.pools.books[bid] || []);
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
        const resourceKey = locatorKey.split('/').pop();

        try {
            const chunkData = await IODriver.fetchResource(path, resourceKey);
            
            // [FIX] Xử lý riêng cho Branch/Structure
            if (isStructure) {
                // Với file Structure, chunkData chính là Book Object { id, structure, meta }
                // Kiểm tra xem suttaId có tồn tại trong meta của book này không
                // (Hoặc suttaId chính là id của book)
                const isValid = chunkData.meta[suttaId] || chunkData.id === suttaId || (suttaId === 'sutta'); // Special case for super root
                
                if (!isValid) {
                    logger.warn("getSutta", `Branch ID ${suttaId} not found in struct file`);
                    return null;
                }

                const result = {
                    uid: suttaId,
                    content: null,
                    // Trích xuất meta của riêng branch này từ file structure lớn
                    meta: { [suttaId]: chunkData.meta[suttaId] || {} }, 
                    isBranch: true,
                    bookStructure: chunkData.structure
                };
                
                this.suttaCache.set(suttaId, result);
                return result;
            }

            // [LOGIC CŨ] Xử lý cho Leaf/Content
            let suttaData = chunkData[suttaId];
            if (!suttaData) return null;

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

            let bookStructure = suttaData.bookStructure || null;
            if (!bookStructure) {
                const bookId = suttaId.match(/^[a-z]+/)[0];
                const structLoc = this.uidIndex.locator[bookId];
                if (structLoc) {
                    const sKey = structLoc.split('/').pop();
                    const sData = await IODriver.fetchResource(`assets/db/${structLoc}.json`, sKey);
                    bookStructure = sData?.structure;
                }
            }

            const result = {
                uid: suttaId,
                content: suttaData.content || null,
                meta: { [suttaId]: suttaData.meta },
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

    async fetchMetaList(uids) {
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
                const data = await IODriver.fetchResource(path, key);
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
            const source = chunkMap[loc];
            if (source) {
                if (source.meta && source.meta[uid]) {
                    result[uid] = source.meta[uid]; 
                } else if (source[uid] && source[uid].meta) {
                    result[uid] = source[uid].meta; 
                }
            }
        });

        return result;
    },

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