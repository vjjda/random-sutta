// Path: web/assets/modules/data/sutta_repository.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaRepository");

const _cache = {
    index: null,
    chunks: {},
    structures: {}
};

export const SuttaRepository = {
    async init() {
        if (_cache.index) return;
        try {
            const resp = await fetch('assets/db/uid_index.json');
            if (!resp.ok) throw new Error("Could not load uid_index.json");
            _cache.index = await resp.json();
            logger.info("init", "DB Index loaded");
        } catch (e) {
            logger.error("init", "Failed to init repository", e);
            throw e;
        }
    },

    _resolveLocator(uid) {
        if (!_cache.index || !_cache.index.locator) return null;
        return _cache.index.locator[uid];
    },

    /**
     * [MỚI] Lấy danh sách Pools từ index
     */
    async getPools() {
        await this.init();
        return _cache.index ? _cache.index.pools : {};
    },

    async _fetchJson(relativePath) {
        // ... (Giữ nguyên logic cache/fetch) ...
        const fullPath = `assets/db/${relativePath}.json`;
        
        if (relativePath.startsWith('content/') && _cache.chunks[relativePath]) return _cache.chunks[relativePath];
        if (relativePath.startsWith('structure/') && _cache.structures[relativePath]) return _cache.structures[relativePath];

        try {
            const resp = await fetch(fullPath);
            if (!resp.ok) return null;
            const data = await resp.json();

            if (relativePath.startsWith('content/')) _cache.chunks[relativePath] = data;
            if (relativePath.startsWith('structure/')) _cache.structures[relativePath] = data;
            
            return data;
        } catch (e) {
            logger.error("fetch", `Error loading ${fullPath}`, e);
            return null;
        }
    },

    async getSuttaEntry(uid) {
        await this.init();
        const locator = this._resolveLocator(uid);
        if (!locator) return null;

        // CASE 1: Branch/Root
        if (locator.startsWith('structure/')) {
            const structData = await this._fetchJson(locator);
            if (!structData) return null;

            const metaInfo = structData.meta && structData.meta[uid];
            return {
                uid: uid,
                meta: metaInfo || {}, 
                // [FIX] Trả về toàn bộ meta của file structure để Renderer vẽ các con
                fullMeta: structData.meta, 
                bookStructure: structData.structure,
                isBranch: true 
            };
        }

        // CASE 2: Leaf/Subleaf
        if (locator.startsWith('content/')) {
            const chunkData = await this._fetchJson(locator);
            if (!chunkData || !chunkData[uid]) return null;
            return chunkData[uid]; 
        }
        return null;
    },

    async fetchMetaList(uids) {
        await this.init();
        const result = {};
        const uniqueIds = [...new Set(uids)].filter(u => u);
        
        await Promise.all(uniqueIds.map(async (uid) => {
            const entry = await this.getSuttaEntry(uid);
            if (entry && entry.meta) {
                result[uid] = entry.meta;
            }
        }));
        return result;
    },

    async getBookStructure(bookId) {
        await this.init();
        let locator = this._resolveLocator(bookId);
        if (!locator) locator = `structure/sutta_${bookId}_${bookId}_struct`;
        return await this._fetchJson(locator);
    }
};