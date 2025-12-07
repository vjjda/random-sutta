// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { NavigationService } from './navigation_service.js';
import { PRIMARY_BOOKS } from '../data/constants.js'; // [MỚI] Import Constants
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaService");

export const SuttaService = {
    async loadFullSuttaData(suttaId) {
        let entry = await SuttaRepository.getSuttaEntry(suttaId);
        if (!entry) {
            logger.warn("load", `${suttaId} not found in DB.`);
            return null;
        }

        const meta = entry.meta || {};
        let content = entry.content;

        // Subleaf Handling
        if (meta.type === 'subleaf' && meta.parent_uid && meta.extract_id) {
            // ... (Giữ nguyên logic extract) ...
            logger.info("load", `${suttaId} is subleaf. Fetching parent ${meta.parent_uid}...`);
            const parentEntry = await SuttaRepository.getSuttaEntry(meta.parent_uid);
            if (parentEntry && parentEntry.content) {
                content = SuttaExtractor.extract(parentEntry.content, meta.extract_id);
            }
        } else if (meta.type === 'alias') {
             return { data: { uid: suttaId, meta: meta, isAlias: true }, navData: null };
        }

        // Navigation
        const bookId = suttaId.match(/^[a-z]+/)[0];
        const structData = await SuttaRepository.getBookStructure(bookId);
        let navData = { prev: null, next: null };
        if (structData && structData.structure) {
            navData = await NavigationService.getNavForSutta(suttaId, structData.structure);
        }

        // Nav Meta
        const uidsToFetch = [];
        if (navData.prev) uidsToFetch.push(navData.prev);
        if (navData.next) uidsToFetch.push(navData.next);
        let navMeta = {};
        if (uidsToFetch.length > 0) {
            navMeta = await SuttaRepository.fetchMetaList(uidsToFetch);
        }

        return {
            data: {
                uid: suttaId,
                // [FIX] Nếu là Branch, dùng fullMeta (chứa info con cái). Nếu không, dùng meta thường.
                meta: entry.isBranch ? entry.fullMeta : meta, 
                navMeta: navMeta, 
                content: content,
                bookStructure: structData ? structData.structure : null,
                isBranch: entry.isBranch
            },
            navData: navData
        };
    },

    // [FIX] Logic Random thực tế
    async getRandomSuttaId(activeFilters) {
        const pools = await SuttaRepository.getPools();
        // pools structure: { books: { "mn": [...], "dn": [...] } }
        
        let candidateBooks = [];
        
        // 1. Xác định các sách cần random
        if (!activeFilters || activeFilters.length === 0) {
            // Nếu không chọn gì -> Random trong Primary Books
            candidateBooks = PRIMARY_BOOKS;
        } else {
            candidateBooks = activeFilters;
        }

        // 2. Gom UID từ các sách đã chọn
        let unifiedPool = [];
        if (pools && pools.books) {
            candidateBooks.forEach(bookId => {
                const bookPool = pools.books[bookId];
                if (bookPool && Array.isArray(bookPool)) {
                    unifiedPool = unifiedPool.concat(bookPool);
                }
            });
        }

        if (unifiedPool.length === 0) {
            logger.warn("random", "No suttas found in selected pool");
            return null;
        }

        // 3. Pick random
        const randomIndex = Math.floor(Math.random() * unifiedPool.length);
        return unifiedPool[randomIndex];
    },
    
    init: () => SuttaRepository.init()
};