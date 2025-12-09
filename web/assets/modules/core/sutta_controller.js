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
  // Load Specific Sutta
  loadSutta: async function (input, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    const isTransition = options.transition === true;
    hideComment();

    // [FIX] Tách biệt ID (để fetch) và Scroll Target (để cuộn)
    let suttaId;
    let scrollTarget = null; // Target ID để cuộn tới (ví dụ: '36.4')

    if (typeof input === 'object') {
        suttaId = input.uid;
        // Nếu payload object có chứa thông tin chunk/scroll thì lấy ở đây (nếu cần)
    } else {
        // String handling (strip hash)
        // Input ví dụ: "mn10#36.4"
        const parts = input.split('#');
        suttaId = parts[0].trim().toLowerCase(); // "mn10"
        
        if (parts.length > 1) {
            scrollTarget = parts[1]; // "36.4"
        }
    }

    logger.info('loadSutta', `Request: ${suttaId} ${scrollTarget ? '(Target: ' + scrollTarget + ')' : ''}`);

    const performRender = async () => {
        console.time('⏱️ Data Fetch');
        
        // [FIX] Luôn truyền suttaId sạch (không có hash) vào Service
        // Nếu truyền "mn10#36.4", IndexResolver sẽ tính sai hash bucket -> 404
        const result = await SuttaService.loadSutta(suttaId);
        
        console.timeEnd('⏱️ Data Fetch');
        
        if (!result) {
            renderSutta(suttaId, null, null, options);
            return false;
        }

        if (result.isAlias) {
            logger.info('loadSutta', `Alias redirect -> ${result.targetUid}`);
            // Đệ quy: Nếu redirect thì gọi lại, giữ nguyên transition setting
            this.loadSutta(result.targetUid, true, 0, { transition: false });
            return true;
        }
        
        console.time('⏱️ Render');
        const success = await renderSutta(suttaId, result, options);
        console.timeEnd('⏱️ Render');
        
        if (success && shouldUpdateUrl) {
             const bookParam = generateBookParam();
             // URL hash sẽ được router tự xử lý hoặc cập nhật sau
             Router.updateURL(suttaId, bookParam, false, scrollTarget ? `#${scrollTarget}` : null, window.scrollY);
        }
        return success;
    };

    if (isTransition) {
        // [FIX] Truyền scrollTarget vào hàm transition để Scroller xử lý sau khi render
        await Scroller.transitionTo(performRender, scrollTarget);
    } else {
        await performRender();
        // Xử lý scroll thủ công nếu không có hiệu ứng chuyển trang
        if (scrollTarget) {
            // Cần delay nhẹ hoặc gọi requestAnimationFrame để đảm bảo DOM đã paint
            requestAnimationFrame(() => Scroller.scrollToId(scrollTarget));
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
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