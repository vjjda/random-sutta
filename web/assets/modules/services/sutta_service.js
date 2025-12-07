// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js'; // Import mới
import { NavigationService } from './navigation_service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaService");

export const SuttaService = {
    async loadFullSuttaData(suttaId) {
        // 1. Lấy dữ liệu thô từ Repository (Load Chunk)
        let entry = await SuttaRepository.getSuttaEntry(suttaId);
        
        if (!entry) {
            logger.warn("load", `${suttaId} not found in DB.`);
            return null;
        }

        const meta = entry.meta || {};
        let content = entry.content;

        // 2. Xử lý SUBLEAF: Extract content từ Parent
        if (meta.type === 'subleaf' && meta.parent_uid && meta.extract_id) {
            logger.info("load", `${suttaId} is subleaf. Fetching parent ${meta.parent_uid}...`);
            
            // Tải entry của Parent (thường nằm cùng chunk nên rất nhanh do cache)
            const parentEntry = await SuttaRepository.getSuttaEntry(meta.parent_uid);
            
            if (parentEntry && parentEntry.content) {
                // Thực hiện Extract
                content = SuttaExtractor.extract(parentEntry.content, meta.extract_id);
            } else {
                logger.error("load", `Parent ${meta.parent_uid} content missing/empty.`);
            }
        }
        // Xử lý ALIAS: Redirect (Logic này có thể handle ở Controller, nhưng data service trả về null content)
        else if (meta.type === 'alias') {
             logger.info("load", `${suttaId} is alias.`);
             return { data: { uid: suttaId, meta: meta, isAlias: true }, navData: null };
        }

        // 3. Lấy Structure để tính Navigation
        // Cần biết Book ID để load file structure.
        // UID: an1.1 -> Book: an.
        const bookId = suttaId.match(/^[a-z]+/)[0]; // Regex đơn giản lấy chữ cái đầu
        const structData = await SuttaRepository.getBookStructure(bookId);
        
        let navData = { prev: null, next: null };
        if (structData && structData.structure) {
            navData = await NavigationService.getNavForSutta(suttaId, structData.structure);
        }

        // 4. Return Data Object chuẩn cho Renderer
        return {
            data: {
                uid: suttaId,
                meta: meta,
                content: content,
                bookStructure: structData ? structData.structure : null, // Để render TOC nếu cần
                isBranch: meta.type === 'branch' // Support render branch card
            },
            navData: navData
        };
    },

    // ... (Giữ nguyên logic getRandomSuttaId) ...
    async getRandomSuttaId(activeFilters) {
         // Logic này cần update để lấy pool từ constants.js hoặc file pool riêng
         // Vì uid_index.json của bạn không chứa list pool sẵn.
         // Tạm thời giữ nguyên hoặc TODO
         return "mn1"; // Placeholder
    }
};