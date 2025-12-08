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
  // Input có thể là String ID hoặc Rich Payload Object
  loadSutta: async function (input, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    const isTransition = options.transition === true;
    hideComment();

    // Parse Input
    let suttaId;
    if (typeof input === 'object') {
        suttaId = input.uid;
    } else {
        // String handling (strip hash)
        let [baseId] = input.split('#');
        suttaId = baseId.trim().toLowerCase();
    }

    logger.info('loadSutta', `Request: ${suttaId}`);

    const performRender = async () => {
        // [UPDATED] Gọi Service với input đa năng
        console.time('⏱️ Data Fetch');
        const result = await SuttaService.loadSutta(input);
        console.timeEnd('⏱️ Data Fetch');
        
        if (!result) {
            renderSutta(suttaId, null, null, options);
            return false;
        }

        // Xử lý Alias Redirect
        if (result.isAlias) {
            logger.info('loadSutta', `Alias redirect -> ${result.targetUid}`);
            // Gọi đệ quy với ID mới
            this.loadSutta(result.targetUid, true, 0, { transition: false }); 
            return true;
        }
        
        // Render
        console.time('⏱️ Render');
        const success = await renderSutta(suttaId, result, options);
        console.timeEnd('⏱️ Render');
        
        if (success && shouldUpdateUrl) {
             Router.updateURL(suttaId, null, false, null, window.scrollY);
        }
        return success;
    };

    if (isTransition) {
        await Scroller.transitionTo(performRender, null); // Simplified scroll logic
    } else {
        await performRender();
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
  },

  loadRandomSutta: async function (shouldUpdateUrl = true) {
    console.time('🚀 Total Random Process');
    hideComment();
    const filters = getActiveFilters();
    
    // [UPDATED] Nhận Rich Payload
    console.time('🎲 Selection');
    const payload = await SuttaService.getRandomPayload(filters);
    console.timeEnd('🎲 Selection');
    
    if (!payload) {
      alert("Database loading or no suttas found.");
      console.timeEnd('🚀 Total Random Process');
      return;
    }
    
    logger.info('loadRandom', `Selected: ${payload.uid} (Fast Path Active)`);
    
    // Truyền cả payload vào loadSutta để kích hoạt Fast Path
    await this.loadSutta(payload, shouldUpdateUrl, 0, { transition: false });
    console.timeEnd('🚀 Total Random Process');
  }
};