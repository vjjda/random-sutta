// Path: web/assets/modules/data/sutta_repository.js
import { getLogger } from '../utils/logger.js';
import { IODriver } from './io_driver.js';
import { OfflineSyncer } from './offline_syncer.js';

// [UPDATED] Import các thành phần con
import { IndexRepository } from './repositories/index_repository.js';
import { SuttaAssembler } from './logic/sutta_assembler.js';

const logger = getLogger("SuttaRepo");

export const SuttaRepository = {
    suttaCache: new Map(),

    // Delegate init sang IndexRepo
    async init() {
        await IndexRepository.ensureLoaded();
    },

    getPool(bookId) {
        return IndexRepository.getPool(bookId);
    },

    async getSutta(suttaId) {
        await this.init();
        if (this.suttaCache.has(suttaId)) return this.suttaCache.get(suttaId);

        const locatorKey = IndexRepository.getLocator(suttaId);
        if (!locatorKey) {
            logger.warn("getSutta", `Locator not found: ${suttaId}`);
            return null;
        }

        const isStructure = locatorKey.includes("_struct");
        const path = `assets/db/${locatorKey}.json`;
        const resourceKey = locatorKey.split('/').pop();

        try {
            const chunkData = await IODriver.fetchResource(path, resourceKey);
            let result = null;

            if (isStructure) {
                // Logic lắp ráp Branch
                result = SuttaAssembler.assembleBranch(suttaId, chunkData);
            } else {
                // Logic lắp ráp Leaf
                let suttaData = chunkData[suttaId];
                if (!suttaData) return null;

                // 1. Resolve Shortcut
                suttaData = SuttaAssembler.resolveShortcut(suttaData, chunkData, suttaId);

                // 2. Load Structure nếu thiếu
                let bookStructure = suttaData.bookStructure || null;
                if (!bookStructure) {
                    const bookId = suttaId.match(/^[a-z]+/)[0];
                    const structLoc = IndexRepository.getLocator(bookId);
                    if (structLoc) {
                        const sKey = structLoc.split('/').pop();
                        const sData = await IODriver.fetchResource(`assets/db/${structLoc}.json`, sKey);
                        bookStructure = sData?.structure;
                    }
                }

                result = SuttaAssembler.assembleLeaf(suttaId, suttaData, bookStructure);
            }

            if (result) this.suttaCache.set(suttaId, result);
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

        // 1. Map UID -> Locator
        uids.forEach(uid => {
            const loc = IndexRepository.getLocator(uid);
            if (loc) {
                chunksToLoad.add(loc);
                uidToChunk[uid] = loc;
            }
        });

        // 2. Parallel Fetch
        const promises = Array.from(chunksToLoad).map(async (loc) => {
            const path = `assets/db/${loc}.json`;
            const key = loc.split('/').pop();
            try {
                return { key: loc, data: await IODriver.fetchResource(path, key) };
            } catch (e) {
                return { key: loc, data: {} };
            }
        });

        const loadedChunks = await Promise.all(promises);
        const chunkMap = {};
        loadedChunks.forEach(item => chunkMap[item.key] = item.data);

        // 3. Extract Meta
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
        try {
            return await IODriver.fetchResource(`assets/db/${loc}.json`, key);
        } catch (e) { return null; }
    },

    async downloadAll(onProgress) {
        await this.init();
        // IndexRepo chứa dữ liệu, OfflineSyncer chứa logic loop
        return OfflineSyncer.downloadAll({ locator: IndexRepository.index.locator }, onProgress);
    }
};