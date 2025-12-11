// Path: web/assets/modules/core/sutta_controller.js
import { SuttaService } from '../services/sutta_service.js';
import { RandomBuffer } from '../services/random_buffer.js';
import { renderSutta } from '../ui/views/renderer.js';
import { Router } from './router.js';
// [FIXED] Import từ filters/index.js
import { FilterComponent } from '../ui/components/filters/index.js'; 
import { initCommentPopup } from '../ui/components/popup.js';
import { Scroller } from '../ui/common/scroller.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaController");
const { hideComment } = initCommentPopup();

export const SuttaController = {
  loadSutta: async function (input, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    // ... (Giữ nguyên logic options/history/transition) ...
    const isTransition = options.transition === true;
    const currentScroll = Scroller.getScrollTop();

    if (shouldUpdateUrl) {
        try {
            const currentState = window.history.state || {};
            window.history.replaceState(
                { ...currentState, scrollY: currentScroll },
                document.title,
                window.location.href
            );
        } catch (e) {}
    }

    hideComment();

    let suttaId;
    let scrollTarget = null;
    if (typeof input === 'object') {
        suttaId = input.uid;
    } else {
        const parts = input.split('#');
        suttaId = parts[0].trim().toLowerCase();
        if (parts.length > 1) {
            scrollTarget = parts[1];
        }
    }

    if (scrollTarget && !scrollTarget.includes(':')) {
        const isSegmentNumber = /^[\d\.]+$/.test(scrollTarget);
        if (isSegmentNumber) {
            scrollTarget = `${suttaId}:${scrollTarget}`;
        }
    }

    logger.info('loadSutta', `Request: ${suttaId} ${scrollTarget ? '(Target: ' + scrollTarget + ')' : ''}`);

    const performRender = async () => {
        console.time('⏱️ Data Fetch');
        const result = await SuttaService.loadSutta(suttaId);
        console.timeEnd('⏱️ Data Fetch');
        
        if (!result) {
            renderSutta(suttaId, null, null, options);
            return false;
        }

        if (result.isAlias) {
            let redirectId = result.targetUid;
            if (result.hashId) {
                redirectId += `#${result.hashId}`;
            }
            this.loadSutta(redirectId, true, 0, { transition: false });
            return true;
        }
        
        console.time('⏱️ Render');
        const success = await renderSutta(suttaId, result, options);
        console.timeEnd('⏱️ Render');
        
        if (success && shouldUpdateUrl) {
             // [UPDATED] Dùng FilterComponent để lấy param
             const bookParam = FilterComponent.generateBookParam();
             Router.updateURL(suttaId, bookParam, false, scrollTarget ? `#${scrollTarget}` : null, currentScroll);
        }
        return success;
    };

    if (isTransition) {
        await Scroller.transitionTo(performRender, scrollTarget);
    } else {
        await performRender();
        if (scrollTarget) {
            setTimeout(() => Scroller.scrollToId(scrollTarget), 0);
        } else if (scrollY > 0) {
            Scroller.restoreScrollTop(scrollY);
        } else {
            Scroller.restoreScrollTop(0);
        }
    }
  },

  loadRandomSutta: async function (shouldUpdateUrl = true) {
    console.time('🚀 Total Random Process');
    hideComment();
    
    // [UPDATED] Dùng FilterComponent để lấy active filters
    const filters = FilterComponent.getActiveFilters();
    
    console.time('🎲 Selection');
    const payload = await RandomBuffer.getPayload(filters);
    console.timeEnd('🎲 Selection');

    if (!payload) {
      alert("Database loading or no suttas found.");
      console.timeEnd('🚀 Total Random Process');
      return;
    }
    
    logger.info('loadRandom', `Selected: ${payload.uid} (Fast Path Active)`);
    await this.loadSutta(payload, shouldUpdateUrl, 0, { transition: false });
    console.timeEnd('🚀 Total Random Process');
  }
};