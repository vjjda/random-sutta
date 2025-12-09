// Path: web/assets/modules/core/sutta_controller.js
import { SuttaService } from '../services/sutta_service.js';
import { RandomBuffer } from '../services/random_buffer.js'; // [NEW]
import { renderSutta } from '../ui/views/renderer.js';
import { Router } from './router.js';
import { getActiveFilters, generateBookParam } from '../ui/components/filters.js';
import { initCommentPopup } from '../ui/components/popup.js';
import { Scroller } from '../ui/common/scroller.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaController");
const { hideComment } = initCommentPopup();

export const SuttaController = {
  // Load Specific Sutta
  loadSutta: async function (input, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    const isTransition = options.transition === true;
    hideComment();

    // Parse Input
    let suttaId;
    if (typeof input === 'object') {
        suttaId = input.uid;
    } else {
        let [baseId] = input.split('#');
        suttaId = baseId.trim().toLowerCase();
    }

    logger.info('loadSutta', `Request: ${suttaId}`);

    const performRender = async () => {
        console.time('⏱️ Data Fetch');
        // Vẫn dùng SuttaService để fetch data cụ thể
        const result = await SuttaService.loadSutta(input);
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
             Router.updateURL(suttaId, bookParam, false, null, window.scrollY);
        }
        return success;
    };

    if (isTransition) {
        await Scroller.transitionTo(performRender, null);
    } else {
        await performRender();
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
  },

  // Load Random Sutta
  loadRandomSutta: async function (shouldUpdateUrl = true) {
    console.time('🚀 Total Random Process');
    hideComment();
    const filters = getActiveFilters();
    
    console.time('🎲 Selection');
    // [UPDATED] Sử dụng RandomBuffer thay vì SuttaService
    const payload = await RandomBuffer.getPayload(filters);
    console.timeEnd('🎲 Selection');
    
    if (!payload) {
      alert("Database loading or no suttas found.");
      console.timeEnd('🚀 Total Random Process');
      return;
    }
    
    logger.info('loadRandom', `Selected: ${payload.uid} (Fast Path Active)`);
    // Truyền payload vào loadSutta
    await this.loadSutta(payload, shouldUpdateUrl, 0, { transition: false });
    console.timeEnd('🚀 Total Random Process');
  }
};