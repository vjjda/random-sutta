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
    
    // [FIX 1] Lưu vị trí cuộn hiện tại trước khi chuyển trang
    // Điều này đảm bảo khi nhấn Back, trình duyệt nhớ được chỗ cũ
    if (shouldUpdateUrl) {
        try {
            const currentScroll = window.scrollY || document.documentElement.scrollTop;
            const currentState = window.history.state || {};
            window.history.replaceState(
                { ...currentState, scrollY: currentScroll },
                document.title,
                window.location.href
            );
        } catch (e) {
            // Ignore history errors
        }
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

    // [FIX 2] Chuẩn hóa scrollTarget để khớp với DOM ID (Bilara format: uid:segment)
    // Nếu target chỉ là số (ví dụ "36.4") mà không có prefix, thêm prefix vào
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
             Router.updateURL(suttaId, bookParam, false, scrollTarget ? `#${scrollTarget}` : null, 0);
        }
        return success;
    };

    if (isTransition) {
        await Scroller.transitionTo(performRender, scrollTarget);
    } else {
        await performRender();
        
        // [FIX 3] Logic cuộn ưu tiên: Target -> Saved Position -> Top
        if (scrollTarget) {
            // Dùng timeout nhẹ để đảm bảo DOM đã render xong hoàn toàn (đôi khi requestAnimationFrame là chưa đủ với content lớn)
            setTimeout(() => Scroller.scrollToId(scrollTarget), 0);
        } else if (scrollY > 0) {
            // Khôi phục vị trí cũ (khi Back)
            window.scrollTo({ top: scrollY, behavior: 'instant' });
        } else {
            // Mặc định lên đầu
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