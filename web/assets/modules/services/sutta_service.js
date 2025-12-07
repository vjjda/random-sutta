// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { NavigationService } from './navigation_service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaService");

export const SuttaService = {
    /**
     * Logic cốt lõi: Lấy dữ liệu bài kinh đầy đủ để hiển thị.
     */
    async loadFullSuttaData(suttaId) {
        // 1. Lấy dữ liệu thô (Content + Meta bản thân)
        let data = await SuttaRepository.getSutta(suttaId);
        
        // Retry logic nếu lần đầu thất bại (do chưa init index chẳng hạn)
        if (!data) {
            await SuttaRepository.init();
            data = await SuttaRepository.getSutta(suttaId);
        }
        
        if (!data) return null;

        // 2. Tính toán Navigation (Prev/Next)
        const navData = await NavigationService.getNavForSutta(suttaId, data.bookStructure);
        
        // 3. Tăng cường Meta (Lấy tên bài kinh cho nút Prev/Next)
        const neighborIds = [navData.prev, navData.next].filter(id => id);
        
        // Gom nhóm ID cần fetch thêm meta (Hàng xóm + Con cháu nếu là Branch)
        const uidsToFetch = [...neighborIds];
        
        if (data.isBranch) {
            // Helper function nhỏ để lấy ID con
            const getChildren = (struct, uid) => {
                 let node = struct[uid];
                 // (Giản lược logic tìm node con, giả định node đã được flatten hoặc dễ tìm)
                 // Trong thực tế, bạn có thể tái sử dụng hàm getChildrenIds ở Controller cũ 
                 // hoặc để Renderer tự xử lý. 
                 // Ở đây tôi giữ đơn giản: Chỉ fetch neighbor để Nav Bar đẹp.
                 return []; 
            };
            // Logic fetch children meta tôi để Renderer tự lo hoặc xử lý sau nếu cần tối ưu
        }

        if (uidsToFetch.length > 0) {
            const extraMetas = await SuttaRepository.fetchMetaList(uidsToFetch);
            Object.assign(data.meta, extraMetas);
        }

        // 4. Merge Escalation Meta (nếu Nav leo thang lên Super Struct)
        if (navData.extraMeta) {
            Object.assign(data.meta, navData.extraMeta);
        }

        return { data, navData };
    },

    /**
     * Logic chọn bài kinh ngẫu nhiên
     */
    async getRandomSuttaId(activeFilters) {
        await SuttaRepository.init();
        let pool = [];
        
        if (!activeFilters || activeFilters.length === 0) {
            pool = SuttaRepository.getPool('primary');
        } else {
            activeFilters.forEach(bid => {
                pool = pool.concat(SuttaRepository.getPool(bid));
            });
        }
        
        if (!pool.length) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    },
    
    // Delegate init cho App
    init: () => SuttaRepository.init()
};