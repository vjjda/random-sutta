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

    // [UPDATED LOGIC] Xác định khi nào cần thêm prefix cho scrollTarget
    // Chỉ thêm prefix nếu scrollTarget thuần túy là số (segment number, vd: "1.2")
    // Nếu scrollTarget có chữ cái (vd: "an1.395-401"), coi nó là ID tuyệt đối và giữ nguyên.
    if (scrollTarget && !scrollTarget.includes(':')) {
        // Regex: Chỉ chứa số và dấu chấm (Segment Number)
        const isSegmentNumber = /^[\d\.]+$/.test(scrollTarget);
        if (isSegmentNumber) {
            scrollTarget = `${suttaId}:${scrollTarget}`;
        }
        // Ngược lại, nếu là "an1.395-401", giữ nguyên để querySelector('#an1.395-401') hoạt động đúng.
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

        // [UPDATED] Alias Handling: Redirect kèm Hash
        if (result.isAlias) {
            logger.info('loadSutta', `Alias redirect -> ${result.targetUid} #${result.hashId || ''}`);
            
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
             const bookParam = generateBookParam();
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