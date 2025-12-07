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
        if (!entry) {
            logger.warn("load", `${suttaId} not found in DB.`);
            return null;
        }

        const meta = entry.meta || {};
        let content = entry.content;

        // Subleaf Handling
        if (meta.type === 'subleaf' && meta.parent_uid && meta.extract_id) {
            logger.info("load", `${suttaId} is subleaf. Fetching parent ${meta.parent_uid}...`);
            const parentEntry = await SuttaRepository.getSuttaEntry(meta.parent_uid);
            if (parentEntry && parentEntry.content) {
                content = SuttaExtractor.extract(parentEntry.content, meta.extract_id);
            }
        } else if (meta.type === 'alias') {
             return { data: { uid: suttaId, meta: meta, isAlias: true }, navData: null };
        }

        // [FIX] Navigation Logic
        let localStructure = null;
        let structData = null;

        // Case A: Nếu bản thân là Branch, Repository đã trả về structure của nó (từ super_struct hoặc file riêng)
        if (entry.isBranch && entry.bookStructure) {
            localStructure = entry.bookStructure;
        } 
        // Case B: Nếu là Leaf/Subleaf, thử load structure của sách chứa nó
        else {
            const bookId = suttaId.match(/^[a-z]+/)[0];
            structData = await SuttaRepository.getBookStructure(bookId);
            if (structData) localStructure = structData.structure;
        }
        
        // [QUAN TRỌNG] Luôn gọi NavigationService, kể cả khi localStructure là null/empty
        // Để NavigationService có cơ hội kích hoạt logic "Escalation" lên super_struct
        const navData = await NavigationService.getNavForSutta(suttaId, localStructure || {});

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
                meta: entry.isBranch ? entry.fullMeta : meta, 
                navMeta: navMeta, 
                content: content,
                // Ưu tiên dùng structure đã load được (cho render TOC)
                bookStructure: localStructure || (structData ? structData.structure : null),
                isBranch: entry.isBranch
            },
            navData: navData
        };
    },

    async getRandomSuttaId(activeFilters) {
        const pools = await SuttaRepository.getPools();
        let candidateBooks = (!activeFilters || activeFilters.length === 0) ? PRIMARY_BOOKS : activeFilters;
        
        let unifiedPool = [];
        if (pools && pools.books) {
            candidateBooks.forEach(bookId => {
                const bookPool = pools.books[bookId];
                if (bookPool && Array.isArray(bookPool)) {
                    unifiedPool = unifiedPool.concat(bookPool);
                }
            });
        }

        if (unifiedPool.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * unifiedPool.length);
        return unifiedPool[randomIndex];
    },
    
    init: () => SuttaRepository.init()
};