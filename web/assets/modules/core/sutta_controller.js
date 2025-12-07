// Path: web/assets/modules/core/sutta_controller.js
import { SuttaService } from '../services/sutta_service.js';
import { renderSutta } from '../ui/views/renderer.js';
import { Router } from './router.js';
import { getActiveFilters } from '../ui/components/filters.js';
import { initCommentPopup } from '../ui/components/popup.js';
import { Scroller } from '../ui/common/scroller.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaController");
const { hideComment } = initCommentPopup();

export const SuttaController = {
  loadSutta: async function (suttaIdInput, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    const isTransition = options.transition === true;
    const currentScrollBeforeRender = window.scrollY;
    hideComment();

    let [baseId, hashPart] = suttaIdInput.split('#');
    const suttaId = baseId.trim().toLowerCase();
    const explicitHash = hashPart || null;
    
    logger.info('loadSutta', `Request: ${suttaId}`);

    const performRender = async () => {
        const result = await SuttaService.loadFullSuttaData(suttaId);
        
        if (!result || !result.data) {
            // Not Found
            renderSutta(suttaId, null, { prev: null, next: null }, options);
            return false;
        }

        // [FIX 3] Xử lý Alias Redirect
        if (result.data.isAlias) {
            const parentUid = result.data.meta.parent_uid;
            logger.info('loadSutta', `${suttaId} is alias -> Redirecting to ${parentUid}`);
            
            // Gọi đệ quy để load parent. 
            // Lưu ý: shouldUpdateUrl=true để URL trên thanh địa chỉ đổi sang Parent (hoặc giữ nguyên tùy strategy)
            // Ở đây ta đổi sang Parent để người dùng thấy nguồn gốc.
            this.loadSutta(parentUid, true, 0, { transition: false }); 
            return true; 
        }

        // Render Normal / Branch
        const success = await renderSutta(suttaId, result.data, result.navData, options);
        
        if (success && shouldUpdateUrl) {
             const finalHash = explicitHash ? `#${explicitHash}` : '';
             Router.updateURL(suttaId, null, false, finalHash, currentScrollBeforeRender);
        }
        return success;
    };

    let targetScrollId = null;
    if (explicitHash) {
        targetScrollId = explicitHash.includes(':') ? explicitHash : `${suttaId}:${explicitHash}`;
    }

    if (isTransition) {
        await Scroller.transitionTo(performRender, targetScrollId);
    } else {
        await performRender();
        if (targetScrollId) setTimeout(() => Scroller.scrollToId(targetScrollId), 0);
        else if (scrollY > 0) window.scrollTo({ top: scrollY, behavior: 'instant' });
        else window.scrollTo({ top: 0, behavior: 'instant' });
    }
  },

  loadRandomSutta: async function (shouldUpdateUrl = true) {
    hideComment();
    const filters = getActiveFilters();
    const targetUid = await SuttaService.getRandomSuttaId(filters);
    if (!targetUid) {
      alert("No suttas found. Please wait for database to load.");
      return;
    }
    logger.info('loadRandomSutta', `Random selection: ${targetUid}`);
    this.loadSutta(targetUid, shouldUpdateUrl, 0, { transition: false });
  }
};