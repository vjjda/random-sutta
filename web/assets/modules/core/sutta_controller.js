// Path: web/assets/modules/core/sutta_controller.js
import { Router } from './router.js';
import { DB } from '../data/db_manager.js';
import { renderSutta } from '../ui/renderer.js';
import { getActiveFilters } from '../ui/filters.js';
import { initCommentPopup } from '../ui/popup_handler.js';
import { getLogger } from '../shared/logger.js';
import { Scroller } from '../ui/scroller.js';

const logger = getLogger("SuttaController");
const { hideComment } = initCommentPopup();

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
        const result = await DB.getSutta(suttaId);
        
        if (!result) {
             await DB.init();
             const retryResult = await DB.getSutta(suttaId);
             if (!retryResult) {
                 renderSutta(suttaId, null, options);
                 return false;
             }
             const success = await renderSutta(suttaId, retryResult, options);
             if (success && shouldUpdateUrl) {
                 const finalHash = explicitHash ? `#${explicitHash}` : '';
                 Router.updateURL(suttaId, null, false, finalHash, currentScrollBeforeRender);
             }
             return success;
        }

        const success = await renderSutta(suttaId, result, options);
        
        if (success && shouldUpdateUrl) {
             const finalHash = explicitHash ? `#${explicitHash}` : '';
             Router.updateURL(suttaId, null, false, finalHash, currentScrollBeforeRender);
        }
        return success;
    };

    // [FIX] Logic thông minh để xác định ID cần scroll
    let targetScrollId = null;

    if (explicitHash) {
        // Trường hợp 1: Hash đã đầy đủ (ví dụ: #mn1:2.3)
        if (explicitHash.includes(':')) {
            targetScrollId = explicitHash;
        } 
        // Trường hợp 2: Hash chỉ là số (ví dụ: #2.3) -> Ghép thêm ID bài kinh (mn1:2.3)
        else {
            // Lưu ý: suttaId ở đây có thể là shortcut (an1.5) hoặc id gốc
            targetScrollId = `${suttaId}:${explicitHash}`;
        }
    } else {
        // Nếu không có hash, kiểm tra xem bài này có scroll_target mặc định không (dùng cho shortcut)
        // Lưu ý: Dữ liệu này phải lấy sau khi load DB, nhưng để nhanh ta check logic "best guess"
        // Hoặc đợi render xong mới scroll chính xác (ở logic dưới).
    }

    // Logic scroll
    if (isTransition) {
        await Scroller.transitionTo(performRender, targetScrollId);
    } else {
        await performRender();
        
        // Sau khi render xong, kiểm tra lại targetScrollId lần cuối
        // Nếu targetScrollId dự đoán bên trên không tìm thấy trong DOM, thử fallback
        if (targetScrollId && !document.getElementById(targetScrollId)) {
             // Fallback: Nếu ghép ID thất bại, thử dùng hash nguyên thủy (ví dụ hash là ID của heading)
             if (document.getElementById(explicitHash)) {
                 targetScrollId = explicitHash;
             }
        }
        
        // Nếu vẫn chưa có target từ hash, thử tìm từ Metadata (Shortcut scroll target)
        if (!targetScrollId && !explicitHash) {
             // Lúc này render đã xong, ta có thể truy cập dữ liệu meta đã load trong DB (nếu cần)
             // Nhưng đơn giản hơn: check params shortcut từ DB (nếu có cached)
             // Hoặc Scroller.scrollToId sẽ tự fail nhẹ nhàng nếu null.
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

  // ... (Hàm loadRandomSutta giữ nguyên) ...
  loadRandomSutta: async function (shouldUpdateUrl = true) {
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