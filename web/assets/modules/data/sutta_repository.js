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
        
        // [FIX] Fallback cho 'tpk' nếu không có trong index
        let locator = this._resolveLocator(uid);
        if (!locator && uid === 'tpk') {
            locator = 'structure/super_struct';
        }
        
        if (!locator) return null;

        // CASE 1: Branch/Root
        if (locator.startsWith('structure/')) {
            const structData = await this._fetchJson(locator);
            if (!structData) return null;

            const metaInfo = structData.meta && structData.meta[uid];
            return {
                uid: uid,
                meta: metaInfo || {}, 
                fullMeta: structData.meta, // Quan trọng: Trả về full meta để nav service dùng
                bookStructure: structData.structure, // Quan trọng: Structure để tính nav
                isBranch: true 
            };
        }
        
        // ... (CASE 2: Content giữ nguyên)
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