// Path: web/assets/modules/core/sutta_controller.js
import { Router } from './router.js';
import { DB } from '../data/db_manager.js';
import { renderSutta } from '../ui/renderer.js';
import { NavigationService } from '../services/navigation_service.js'; // [NEW]
import { getActiveFilters } from '../ui/filters.js';
import { initCommentPopup } from '../ui/popup_handler.js';
import { getLogger } from '../shared/logger.js';
import { Scroller } from '../ui/scroller.js';

const logger = getLogger("SuttaController");
const { hideComment } = initCommentPopup();

// [HELPER] Logic lấy ID con của một Branch (Moved from Renderer)
function getChildrenIds(structure, currentUid) {
    function findNode(node, targetId) {
        if (!node) return null;
        if (Array.isArray(node)) {
            for (let item of node) {
                if (item[targetId]) return item[targetId];
                const found = findNode(item, targetId);
                if (found) return found;
            }
            return null;
        }
        if (typeof node === 'object') {
            if (node[targetId]) return node[targetId];
            for (let key in node) {
                if (key === 'meta' || typeof node[key] !== 'object') continue;
                const found = findNode(node[key], targetId);
                if (found) return found;
            }
        }
        return null;
    }
    const node = structure[currentUid] ? structure[currentUid] : findNode(structure, currentUid);
    if (!node) return [];
    
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

export const SuttaController = {
  loadSutta: async function (suttaIdInput, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    const isTransition = options.transition === true;
    const currentScrollBeforeRender = window.scrollY;
    hideComment();

    let [baseId, hashPart] = suttaIdInput.split('#');
    const suttaId = baseId.trim().toLowerCase();
    const explicitHash = hashPart ? hashPart : null;

    logger.info('loadSutta', `Request: ${suttaId} ${explicitHash ? '#' + explicitHash : ''}`);

    const performRender = async () => {
        // 1. Fetch Data
        let result = await DB.getSutta(suttaId);
        if (!result) {
             await DB.init();
             result = await DB.getSutta(suttaId);
             if (!result) {
                 // Not found -> Render Error (NavData rỗng)
                 renderSutta(suttaId, null, { prev: null, next: null }, options);
                 return false;
             }
        }

        // 2. [NEW] Calculate Navigation
        const navData = await NavigationService.getNavForSutta(suttaId, result.bookStructure);
        
        // Merge extraMeta từ Navigation (nếu có escalations)
        if (navData.extraMeta) {
            Object.assign(result.meta, navData.extraMeta);
        }

        // 3. [NEW] Prepare Branch Meta (Nếu là Branch View)
        // Logic này trước kia nằm trong Renderer, giờ chuyển về Controller để Renderer thuần khiết
        if (result.isBranch) {
            const childrenIds = getChildrenIds(result.bookStructure, result.uid);
            if (childrenIds.length > 0) {
                const leavesToFetch = childrenIds.filter(id => !result.meta[id]);
                if (leavesToFetch.length > 0) {
                    const leafMetas = await DB.fetchMetaForUids(leavesToFetch);
                    Object.assign(result.meta, leafMetas);
                }
            }
        }

        // 4. Render UI
        const success = await renderSutta(suttaId, result, navData, options);

        // 5. Update URL
        if (success && shouldUpdateUrl) {
             const finalHash = explicitHash ? `#${explicitHash}` : '';
             Router.updateURL(suttaId, null, false, finalHash, currentScrollBeforeRender);
        }
        return success;
    };

    // Logic Scroll giữ nguyên
    let targetScrollId = null;
    if (explicitHash) {
        if (explicitHash.includes(':')) {
            targetScrollId = explicitHash;
        } else {
            targetScrollId = `${suttaId}:${explicitHash}`;
        }
    }

    if (isTransition) {
        await Scroller.transitionTo(performRender, targetScrollId);
    } else {
        await performRender();
        if (targetScrollId && !document.getElementById(targetScrollId)) {
             if (document.getElementById(explicitHash)) {
                  targetScrollId = explicitHash;
             }
        }
        if (targetScrollId) {
            setTimeout(() => Scroller.scrollToId(targetScrollId), 0);
        } else if (scrollY > 0) {
            window.scrollTo({ top: scrollY, behavior: 'instant' });
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }
  },

  loadRandomSutta: async function (shouldUpdateUrl = true) {
    // ... Logic Random giữ nguyên ...
    hideComment();
    await DB.init();
    
    const activeFilters = getActiveFilters(); 
    let pool = [];
    if (activeFilters.length === 0) {
        pool = DB.getPool('primary');
    } else {
        activeFilters.forEach(bookId => {
            const bookPool = DB.getPool(bookId);
            if (bookPool) pool = pool.concat(bookPool);
        });
    }

    if (!pool || pool.length === 0) {
      alert("No suttas found. Please wait for database to load or check filters.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    const targetUid = pool[randomIndex];
    
    logger.info('loadRandomSutta', `Random selection: ${targetUid}`);
    this.loadSutta(targetUid, shouldUpdateUrl, 0, { transition: false });
  }
};