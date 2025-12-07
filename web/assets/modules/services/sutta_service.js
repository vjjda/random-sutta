// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { NavigationService } from './navigation_service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaService");

// [HELPER] Trích xuất danh sách ID con từ cấu trúc
function getChildrenIds(structure, currentUid) {
    if (!structure) return [];
    
    // Đệ quy tìm node
    function findNode(node, targetId) {
        if (!node) return null;
        
        // Nếu node là mảng (children list)
        if (Array.isArray(node)) {
            for (let item of node) {
                if (typeof item === 'object' && item[targetId]) return item[targetId];
                // Deep search
                const found = findNode(item, targetId);
                if (found) return found;
            }
            return null;
        }
        
        // Nếu node là object (branch map)
        if (typeof node === 'object') {
            if (node[targetId]) return node[targetId];
            
            // Special case cho root: 'tpk' chứa 'sutta'
            if (targetId === 'sutta' && node['tpk'] && node['tpk']['sutta']) return node['tpk']['sutta'];

            for (let key in node) {
                if (key === 'meta' || typeof node[key] !== 'object') continue;
                const found = findNode(node[key], targetId);
                if (found) return found;
            }
        }
        return null;
    }

    // Nếu currentUid là root key của structure (ví dụ 'mn'), lấy trực tiếp
    let node = structure[currentUid];
    
    // Nếu không tìm thấy ở root level, tìm sâu bên trong
    if (!node) node = findNode(structure, currentUid);
    
    if (!node) return [];
    
    // Flatten danh sách ID con
    let ids = [];
    if (Array.isArray(node)) {
        node.forEach(item => {
            if (typeof item === 'string') ids.push(item);
            else if (typeof item === 'object') ids.push(...Object.keys(item));
        });
    } else if (typeof node === 'object') {
        ids = Object.keys(node);
    }
    return ids;
}

export const SuttaService = {
    async loadFullSuttaData(suttaId) {
        // 1. Get Core Data
        let data = await SuttaRepository.getSutta(suttaId);
        
        if (!data) {
            await SuttaRepository.init();
            data = await SuttaRepository.getSutta(suttaId);
        }
        
        if (!data) return null;

        // 2. Calculate Nav
        const navData = await NavigationService.getNavForSutta(suttaId, data.bookStructure);
        
        // 3. Prepare UIDs to fetch extra Meta
        // Bao gồm: Hàng xóm (Nav) và Con cái (nếu là Branch)
        const uidsToFetch = [];
        
        if (navData.prev) uidsToFetch.push(navData.prev);
        if (navData.next) uidsToFetch.push(navData.next);

        if (data.isBranch) {
            const childIds = getChildrenIds(data.bookStructure, suttaId);
            // Lọc những ID chưa có meta trong data hiện tại
            const missingChildren = childIds.filter(id => !data.meta[id]);
            uidsToFetch.push(...missingChildren);
        }

        // 4. Batch Fetch Meta
        if (uidsToFetch.length > 0) {
            // Loại bỏ trùng lặp
            const uniqueIds = [...new Set(uidsToFetch)];
            const extraMetas = await SuttaRepository.fetchMetaList(uniqueIds);
            Object.assign(data.meta, extraMetas);
        }

        // 5. Merge Escalation Meta
        if (navData.extraMeta) {
            Object.assign(data.meta, navData.extraMeta);
        }

        return { data, navData };
    },

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
    
    init: () => SuttaRepository.init()
};