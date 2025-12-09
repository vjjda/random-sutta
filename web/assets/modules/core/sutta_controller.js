// Path: web/assets/modules/core/sutta_controller.js
import { SuttaService } from '../services/sutta_service.js';
import { RandomBuffer } from '../services/random_buffer.js';
import { renderSutta } from '../ui/views/renderer.js';
import { Router } from './router.js';
import { getActiveFilters, generateBookParam } from '../ui/components/filters.js';
import { initCommentPopup } from '../ui/components/popup.js';
import { Scroller } from '../ui/common/scroller.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaController");
const { hideComment } = initCommentPopup();

export const SuttaController = {
  loadSutta: async function (input, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    const isTransition = options.transition === true;
    
    // [CLEAN] Sử dụng Scroller để lấy vị trí (Semantic Code)
    // Dòng này rất rõ nghĩa: "Lấy vị trí hiện tại", khó bị xóa nhầm khi refactor
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

    if (scrollTarget && !scrollTarget.includes(':') && !scrollTarget.startsWith(suttaId)) {
        scrollTarget = `${suttaId}:${scrollTarget}`;
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
            logger.info('loadSutta', `Alias redirect -> ${result.targetUid}`);
            this.loadSutta(result.targetUid, true, 0, { transition: false });
            return true;
        }
        
        console.time('⏱️ Render');
        const success = await renderSutta(suttaId, result, options);
        console.timeEnd('⏱️ Render');
        
        if (success && shouldUpdateUrl) {
             const bookParam = generateBookParam();
             // Pass currentScroll to Router history
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
            // [CLEAN] Sử dụng Scroller để khôi phục (Semantic Code)
            Scroller.restoreScrollTop(scrollY);
        } else {
            Scroller.restoreScrollTop(0);
        }
    }
  },

  loadRandomSutta: async function (shouldUpdateUrl = true) {
    console.time('🚀 Total Random Process');
    hideComment();
    const filters = getActiveFilters();
    
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