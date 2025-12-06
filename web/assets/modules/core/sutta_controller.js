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

    logger.info('loadSutta', `Request: ${suttaId}`);

    // [CLEANED] Bỏ logic Lazy Loading cũ dùng SuttaLoader ở đây.
    // DB mới đã tự động xử lý việc load chunk cần thiết.

    // 1. Prepare Render Action
    const performRender = async () => {
        // Gọi Renderer mới (Async) - DB sẽ tự tải chunk và structure
        const result = await DB.getSutta(suttaId);
        
        // Nếu không có dữ liệu
        if (!result) {
             // Retry: Thử load lại index nếu chưa có (phòng trường hợp race condition lúc khởi động)
             await DB.init();
             // Thử lại lần nữa
             const retryResult = await DB.getSutta(suttaId);
             if (!retryResult) {
                 // Vẫn không thấy -> 404
                 renderSutta(suttaId, null, options);
                 return false;
             }
             // Thành công lần 2
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

    // 2. Execution
    let targetScrollId = explicitHash;
    
    if (isTransition) {
        await Scroller.transitionTo(performRender, targetScrollId);
    } else {
        await performRender();
        
        if (targetScrollId) {
            setTimeout(() => Scroller.scrollToId(targetScrollId), 0);
        } else if (scrollY > 0) {
            window.scrollTo({ top: scrollY, behavior: 'instant' });
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }
  },

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