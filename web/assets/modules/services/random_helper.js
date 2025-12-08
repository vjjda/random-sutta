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
    // 1. Warm-up
    init() {
        this._getOrBuildWeightedMap([]);
    },

    // 2. Internal Helpers
    _getFiltersHash(activeFilters) {
        if (!activeFilters || activeFilters.length === 0) return "ALL";
        return activeFilters.slice().sort().join("|");
    },

    _getOrBuildWeightedMap(activeFilters) {
        const currentHash = this._getFiltersHash(activeFilters);
        
        if (_cachedWeightedMap && _lastFiltersHash === currentHash) {
            return _cachedWeightedMap;
        }

        // --- Logic tính toán trọng số ---
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

    async _getPoolForBook(bookId) {
        // Cache RAM Layer
        if (_poolRamCache.has(bookId)) {
            return _poolRamCache.get(bookId);
        }

        try {
            // Data Layer
            let poolData = [];
            if (SuttaRepository.fetchPool) {
                poolData = await SuttaRepository.fetchPool(bookId);
            } else {
                // Fallback
                const response = await fetch(`./assets/db/pools/${bookId}.json`);
                if (!response.ok) throw new Error("Pool not found");
                poolData = await response.json();
            }

            if (poolData && Array.isArray(poolData)) {
                _poolRamCache.set(bookId, poolData);
            }
            return poolData;
        } catch (e) {
            logger.error("_getPoolForBook", `Failed to load pool for ${bookId}`, e);
            return [];
        }
    },

    // 3. Main API
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