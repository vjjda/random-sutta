// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { NavigationService } from './navigation_service.js';
import { PRIMARY_BOOKS } from '../data/constants.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaService");

export const SuttaService = {
    async loadFullSuttaData(suttaId) {
        let entry = await SuttaRepository.getSuttaEntry(suttaId);
        if (!entry) return null;

        const meta = entry.meta || {};
        let content = entry.content;

        // ... (Logic Subleaf/Alias giữ nguyên) ...
        if (meta.type === 'subleaf' && meta.parent_uid && meta.extract_id) {
            const parentEntry = await SuttaRepository.getSuttaEntry(meta.parent_uid);
            if (parentEntry && parentEntry.content) {
                content = SuttaExtractor.extract(parentEntry.content, meta.extract_id);
            }
        } else if (meta.type === 'alias') {
             return { data: { uid: suttaId, meta: meta, isAlias: true }, navData: null };
        }

        // Structure Handling
        let localStructure = null;
        let structData = null;

        if (entry.isBranch && entry.bookStructure) {
            localStructure = entry.bookStructure;
        } else {
            const bookId = suttaId.match(/^[a-z]+/)[0];
            structData = await SuttaRepository.getBookStructure(bookId);
            if (structData) localStructure = structData.structure;
        }
        
        // [FIX] Truyền Meta vào NavigationService
        // Nếu là Branch (load từ _struct), dùng entry.fullMeta (meta gộp của cả sách)
        // Nếu là Leaf, structData cũng chứa meta của cả sách đó
        const contextMeta = entry.isBranch ? entry.fullMeta : (structData ? structData.meta : meta);

        const navData = await NavigationService.getNavForSutta(suttaId, localStructure || {}, contextMeta);

        // ... (Logic Fetch Nav Meta giữ nguyên) ...
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
                meta: entry.isBranch ? entry.fullMeta : meta, 
                navMeta: navMeta, 
                content: content,
                bookStructure: localStructure,
                isBranch: entry.isBranch
            },
            navData: navData
        };
    },
    // ... (Phần còn lại giữ nguyên) ...
    async getRandomSuttaId(activeFilters) {
        const pools = await SuttaRepository.getPools();
        let candidateBooks = (!activeFilters || activeFilters.length === 0) ? PRIMARY_BOOKS : activeFilters;
        let unifiedPool = [];
        if (pools && pools.books) {
            candidateBooks.forEach(bookId => {
                const bookPool = pools.books[bookId];
                if (bookPool && Array.isArray(bookPool)) unifiedPool = unifiedPool.concat(bookPool);
            });
        }
        if (unifiedPool.length === 0) return null;
        return unifiedPool[Math.floor(Math.random() * unifiedPool.length)];
    },
    init: () => SuttaRepository.init()
};