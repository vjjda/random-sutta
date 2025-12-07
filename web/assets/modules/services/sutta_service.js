// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { NavigationService } from './navigation_service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaService");

export const SuttaService = {
    async loadFullSuttaData(suttaId) {
        // 1. Get Entry
        let entry = await SuttaRepository.getSuttaEntry(suttaId);
        
        if (!entry) {
            logger.warn("load", `${suttaId} not found in DB.`);
            return null;
        }

        const meta = entry.meta || {};
        let content = entry.content;

        // 2. Handle Subleaf (Extraction)
        if (meta.type === 'subleaf' && meta.parent_uid && meta.extract_id) {
            logger.info("load", `${suttaId} is subleaf. Fetching parent ${meta.parent_uid}...`);
            const parentEntry = await SuttaRepository.getSuttaEntry(meta.parent_uid);
            
            if (parentEntry && parentEntry.content) {
                content = SuttaExtractor.extract(parentEntry.content, meta.extract_id);
            } else {
                logger.error("load", `Parent ${meta.parent_uid} content missing.`);
            }
        } 
        // 3. Handle Alias
        else if (meta.type === 'alias') {
             return { data: { uid: suttaId, meta: meta, isAlias: true }, navData: null };
        }

        // 4. Navigation & Structure
        // Lấy Book ID (vd: 'mn' từ 'mn1')
        const bookId = suttaId.match(/^[a-z]+/)[0];
        const structData = await SuttaRepository.getBookStructure(bookId);
        
        let navData = { prev: null, next: null };
        if (structData && structData.structure) {
            navData = await NavigationService.getNavForSutta(suttaId, structData.structure);
        }

        // 5. Fetch Navigation Metadata (NavMeta)
        // Tách riêng meta của Prev/Next để không trộn lẫn vào meta bài chính
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
                meta: meta,        // Meta chính chủ
                navMeta: navMeta,  // Meta hàng xóm (Mới)
                content: content,
                bookStructure: structData ? structData.structure : null,
                isBranch: entry.isBranch
            },
            navData: navData
        };
    },

    async getRandomSuttaId(activeFilters) {
        // TODO: Cần implement logic lấy random pool từ constants.js
        // Tạm thời return hardcode để test flow
        return "mn1"; 
    }
};