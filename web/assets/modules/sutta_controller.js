// Path: web/assets/modules/sutta_controller.js
import { SuttaLoader } from './loader.js';
import { Router } from './router.js';
import { DB } from './db_manager.js';
import { renderSutta } from './renderer.js';
import { getActiveFilters } from './filters.js';
import { initCommentPopup } from './utils.js';
import { getLogger } from './logger.js';
import { Scroller } from './scroller.js';

const logger = getLogger("SuttaController");
const { hideComment } = initCommentPopup();

export const SuttaController = {
  loadSutta: async function (suttaIdInput, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    // 1. Setup & Parsing
    const isTransition = options.transition === true;
    const currentScrollBeforeRender = window.scrollY;
    hideComment();

    let [baseId, hashPart] = suttaIdInput.split('#');
    const suttaId = baseId.trim().toLowerCase();
    const explicitHash = hashPart ? hashPart : null;

    logger.info(`Request to load: ${suttaId} ${explicitHash ? `(Hash: ${explicitHash})` : ''} ${isTransition ? '[Transition]' : ''}`);

    // 2. Lazy Loading Check
    // Kiểm tra xem sách chứa sutta này đã tải chưa, nếu chưa thì tải trước
    const bookFile = SuttaLoader.findBookFileFromSuttaId(suttaId);
    if (bookFile) {
        const dbKey = bookFile.replace(/_book\.js$/, '').replace(/\//g, '_');
        
        // Tránh loop vô hạn nếu file đã load mà vẫn không tìm thấy sutta
        if (!window.SUTTA_DB || !window.SUTTA_DB[dbKey]) {
             const bookId = bookFile.split('/').pop().replace('_book.js', '').replace('.js', '');
             try {
                 logger.debug(`Lazy loading book: ${bookId}`);
                 await SuttaLoader.loadBook(bookId);
                 // Đệ quy gọi lại chính nó sau khi load xong
                 return this.loadSutta(suttaIdInput, shouldUpdateUrl, scrollY, options);
             } catch (err) {
                 logger.error(`Lazy load failed for ${bookId}`, err);
             }
        }
    }

    // 3. Shortcut Logic (Xử lý các ID ảo trỏ về ID thật)
    const meta = DB.getMeta(suttaId);
    if (meta && meta.type === 'shortcut') {
        const parentId = meta.parent_uid;
        logger.debug(`Shortcut detected: ${suttaId} -> ${parentId}`);
        
        // Nếu là shortcut, ta chuyển hướng sang parent
        // Giữ nguyên các options (như transition) nhưng update ID highlight
        const targetScrollId = meta.scroll_target;
        const shouldDisableHighlight = meta.is_implicit === true;

        // Gọi đệ quy nhưng trỏ vào parent
        // Lưu ý: Ta không update URL thành parent mà giữ nguyên URL shortcut (logic cũ)
        // hoặc update tùy strategy. Ở đây ta render Parent nhưng highlight con.
        
        // Cách đơn giản nhất: Render parent trực tiếp
        // Update options để render đúng target
        options.highlightId = targetScrollId;
        options.noHighlight = shouldDisableHighlight;
        
        // Gọi lại logic render cho Parent ID
        // (Lưu ý: Dùng ID parent để tìm content, nhưng URL vẫn có thể muốn giữ là shortcut)
        // Tuy nhiên để đơn giản, ta coi như load parent.
        return this.loadSutta(`${parentId}#${targetScrollId || ''}`, shouldUpdateUrl, scrollY, options);
    }

    // 4. Prepare Render Action
    // Đóng gói việc render vào một hàm để Scroller có thể gọi đúng thời điểm (giữa Fade Out và Fade In)
    const performRender = () => {
        // Gọi Renderer (Chỉ sinh HTML, không scroll)
        const success = renderSutta(suttaId, { ...options });
        
        if (success && shouldUpdateUrl) {
             const finalHash = explicitHash ? `#${explicitHash}` : '';
             Router.updateURL(suttaId, null, false, finalHash, currentScrollBeforeRender);
        }
        return success;
    };

    // 5. Execution Strategy (Quyết định cách chạy)
    
    // Xác định đích đến để cuộn (ưu tiên Hash trên URL -> Highlight ID -> Metadata)
    let targetScrollId = explicitHash;
    if (!targetScrollId && options.highlightId) {
        targetScrollId = options.highlightId.replace('#', '');
    }
    if (!targetScrollId) {
        const m = DB.getMeta(suttaId);
        if (m && m.scroll_target) targetScrollId = m.scroll_target;
    }

    if (isTransition) {
        // CASE A: Chuyển cảnh (Click Link, Next/Prev, Random)
        // Scroller sẽ lo: Fade Out -> Render -> Scroll -> Fade In
        await Scroller.transitionTo(performRender, targetScrollId);
    } else {
        // CASE B: Load trực tiếp (F5, Enter URL)
        // Render ngay lập tức
        performRender();
        
        // Xử lý Scroll ngay lập tức (nhưng vẫn qua Scroller để tính Offset chính xác)
        if (targetScrollId) {
            // setTimeout 0 để đảm bảo DOM paint xong
            setTimeout(() => Scroller.scrollToId(targetScrollId), 0);
        } else if (scrollY > 0) {
            window.scrollTo(0, scrollY);
        } else {
            window.scrollTo(0, 0);
        }
    }
  },

  loadRandomSutta: function (shouldUpdateUrl = true) {
    hideComment();
    if (!window.SUTTA_DB) return;
    const allSuttas = DB.getAllAvailableSuttas();
    if (allSuttas.length === 0) return;

    const activePrefixes = getActiveFilters();
    const filteredKeys = allSuttas.filter((key) => {
      return activePrefixes.some((prefix) => {
        if (!key.startsWith(prefix)) return false;
        const nextChar = key.charAt(prefix.length);
        return /\d/.test(nextChar); 
      });
    });
    
    if (filteredKeys.length === 0) {
      alert("No suttas match your selected filters!");
      return;
    }

    const randomIndex = Math.floor(Math.random() * filteredKeys.length);
    const target = filteredKeys[randomIndex];
    
    logger.info(`Random selection: ${target}`);
    
    // Luôn bật hiệu ứng chuyển cảnh cho Random
    this.loadSutta(target, shouldUpdateUrl, 0, { transition: true });
  }
};