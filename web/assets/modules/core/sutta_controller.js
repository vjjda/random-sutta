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
        // [REFACTORED] Gọi Service thay vì tự gọi Repository
        const result = await SuttaService.loadFullSuttaData(suttaId);

        if (!result) {
            // Not Found
            renderSutta(suttaId, null, { prev: null, next: null }, options);
            return false;
        }

        // Render
        const success = await renderSutta(suttaId, result.data, result.navData, options);

        if (success && shouldUpdateUrl) {
             const finalHash = explicitHash ? `#${explicitHash}` : '';
             Router.updateURL(suttaId, null, false, finalHash, currentScrollBeforeRender);
        }
        return success;
    };

    // [KEEP] Scroll Logic
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
    // [REFACTORED] Gọi Service
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