// Path: web/assets/modules/core/sutta_controller.js
import { Router } from './router.js';
import { DB } from '../data/db_manager.js'; // [UPDATED]
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

    // 1. Parse Input (an1.5#1.1 -> an1.5, #1.1)
    let [baseId, hashPart] = suttaIdInput.split('#');
    const suttaId = baseId.trim().toLowerCase();
    const explicitHash = hashPart ? hashPart : null;

    logger.info('loadSutta', `Request: ${suttaId}`);

    // 2. Fetch Data from New DB
    // [NEW] Không còn SuttaLoader.loadBook nữa, DB tự lo
    const data = await DB.getSutta(suttaId);

    if (!data) {
        renderSutta(suttaId, null); // Render trang lỗi 404
        return;
    }

    // 3. Logic Scroll Target
    // Nếu là Shortcut (an1.5) nhưng nội dung thực tế là an1.1-10
    // Ta cần scroll đến ID an1.5 bên trong nội dung đó.
    let targetScrollId = explicitHash;
    
    // Nếu không có hash cụ thể, kiểm tra xem bản thân ID này có phải scroll target không
    if (!targetScrollId) {
        if (data.meta && data.meta.scroll_target) {
            targetScrollId = data.meta.scroll_target;
        } else if (data.meta.type === 'shortcut') {
             // Fallback cho shortcut cũ nếu chưa có scroll_target
             targetScrollId = suttaId; 
        }
    }

    // 4. Render
    const performRender = () => {
        // [IMPORTANT] Truyền data trực tiếp vào renderer
        // Renderer không cần gọi DB.get... nữa vì ta đã lấy rồi
        const success = renderSutta(suttaId, data, options); 
        
        if (success && shouldUpdateUrl) {
             const finalHash = explicitHash ? `#${explicitHash}` : '';
             // Nếu là shortcut, ta vẫn giữ URL là shortcut (an1.5) chứ không đổi thành parent
             Router.updateURL(suttaId, null, false, finalHash, currentScrollBeforeRender);
        }
        return success;
    };

    if (isTransition) {
        await Scroller.transitionTo(performRender, targetScrollId);
    } else {
        performRender();
        if (targetScrollId) {
            // Chờ DOM vẽ xong
            requestAnimationFrame(() => {
                setTimeout(() => Scroller.scrollToId(targetScrollId), 0);
            });
        } else if (scrollY > 0) {
            window.scrollTo({ top: scrollY, behavior: 'instant' });
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }
  },

  loadRandomSutta: async function (shouldUpdateUrl = true) {
    hideComment();
    // Đảm bảo Index đã load
    await DB.init();

    // 1. Xác định Pool
    const activeFilters = getActiveFilters(); // ['dn', 'mn'] hoặc []
    let pool = [];

    if (activeFilters.length === 0) {
        // Mặc định: Primary Pool
        pool = DB.getPool('primary');
    } else {
        // Filtered Pool
        activeFilters.forEach(bookId => {
            const bookPool = DB.getPool(bookId);
            if (bookPool) pool = pool.concat(bookPool);
        });
    }

    if (pool.length === 0) {
      alert("No suttas found for current filters.");
      return;
    }

    // 2. Pick Random
    const randomIndex = Math.floor(Math.random() * pool.length);
    const targetUid = pool[randomIndex];
    
    logger.info('loadRandomSutta', `Random selection: ${targetUid}`);
    this.loadSutta(targetUid, shouldUpdateUrl, 0, { transition: false });
  }
};