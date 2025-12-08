// Path: web/assets/modules/services/random_helper.js
import { PRIMARY_BOOKS, SUB_BOOKS, SUTTA_COUNTS } from '../data/constants.js';
import { SuttaRepository } from '../data/sutta_repository.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("RandomHelper");

// --- INTERNAL STATE (RAM CACHE) ---
let _cachedWeightedMap = null;
let _lastFiltersHash = "";
const _poolRamCache = new Map();

export const RandomHelper = {
    init() {
        this._getOrBuildWeightedMap([]);
    },

    _getFiltersHash(activeFilters) {
        if (!activeFilters || activeFilters.length === 0) return "ALL";
        return activeFilters.slice().sort().join("|");
    },

    _getOrBuildWeightedMap(activeFilters) {
        const currentHash = this._getFiltersHash(activeFilters);
        
        if (_cachedWeightedMap && _lastFiltersHash === currentHash) {
            return _cachedWeightedMap;
        }

        const rootBooks = (!activeFilters || activeFilters.length === 0) ?
            PRIMARY_BOOKS : activeFilters;
        
        let candidates = [];
        for (const bookId of rootBooks) {
            if (SUB_BOOKS[bookId]) {
                for (const sub of SUB_BOOKS[bookId]) {
                    candidates.push(sub);
                }
            } else {
                candidates.push(bookId);
            }
        }

        let totalWeight = 0;
        const weightedCandidates = [];

        for (const bookId of candidates) {
            const count = SUTTA_COUNTS[bookId] || 0;
            if (count > 0) {
                totalWeight += count;
                weightedCandidates.push({ id: bookId, weight: count });
            }
        }

        _cachedWeightedMap = { totalWeight, weightedCandidates };
        _lastFiltersHash = currentHash;
        
        return _cachedWeightedMap;
    },

    // [FIXED] Logic này giờ sẽ lấy từ META thay vì POOL file
    async _getPoolForBook(bookId) {
        // 1. Kiểm tra RAM trước (Siêu nhanh)
        if (_poolRamCache.has(bookId)) {
            return _poolRamCache.get(bookId);
        }

        try {
            // 2. Tải Meta File (Chứa cả pool lẫn title/nav)
            // SuttaRepository sẽ lo việc cache file này dưới Disk/SW
            const bookMeta = await SuttaRepository.fetchMeta(bookId);
            
            if (bookMeta && bookMeta.random_pool) {
                const poolData = bookMeta.random_pool;
                
                // 3. Cache mảng ID vào RAM để lần sau không phải parse JSON nữa
                _poolRamCache.set(bookId, poolData);
                return poolData;
            }
            
            return [];
        } catch (e) {
            logger.error("_getPoolForBook", `Failed to load meta for ${bookId}`, e);
            return [];
        }
    },

    async getRandomPayload(activeFilters) {
        const { totalWeight, weightedCandidates } = this._getOrBuildWeightedMap(activeFilters);

        if (totalWeight === 0) return null;

        let randomVal = Math.floor(Math.random() * totalWeight);
        let targetBook = null;

        for (const item of weightedCandidates) {
            if (randomVal < item.weight) {
                targetBook = item.id;
                break;
            }
            randomVal -= item.weight;
        }

        logger.info("getRandomPayload", `Selected Book: ${targetBook}`);

        const randomPool = await this._getPoolForBook(targetBook);
        
        if (!randomPool || randomPool.length === 0) {
            logger.warn("getRandomPayload", `Book ${targetBook} has empty pool.`);
            return null;
        }

        const randomIdx = Math.floor(Math.random() * randomPool.length);
        const targetUid = randomPool[randomIdx];
        
        return {
            uid: targetUid,
            book_id: targetBook
        };
    }
};