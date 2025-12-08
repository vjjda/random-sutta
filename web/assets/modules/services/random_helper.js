// Path: web/assets/modules/services/random_helper.js
import { PRIMARY_BOOKS, SUB_BOOKS, SUTTA_COUNTS, RANDOM_POOLS } from '../data/constants.js'; 
import { getLogger } from '../utils/logger.js';

const logger = getLogger("RandomHelper");

// --- INTERNAL STATE ---
let _cachedWeightedMap = null;
let _lastFiltersHash = "";

export const RandomHelper = {
    // Không cần init async nữa, nhưng giữ hàm để tương thích interface
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

    // Hàm đồng bộ hoàn toàn (Synchronous)
    getRandomPayloadSync(activeFilters) {
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

        logger.info("Random", `Selected Book: ${targetBook}`);

        // [OPTIMIZATION] Lấy trực tiếp từ constants.js
        const randomPool = RANDOM_POOLS[targetBook];
        
        if (!randomPool || randomPool.length === 0) {
            logger.warn("Random", `Book ${targetBook} has empty pool in constants.`);
            return null;
        }

        const randomIdx = Math.floor(Math.random() * randomPool.length);
        const targetUid = randomPool[randomIdx];
        
        return {
            uid: targetUid,
            book_id: targetBook
        };
    },

    // Giữ API cũ (async) để tương thích với SuttaService
    async getRandomPayload(activeFilters) {
        return this.getRandomPayloadSync(activeFilters);
    }
};