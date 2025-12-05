// Path: web/assets/modules/sutta_controller.js
import { SuttaLoader } from './loader.js';
import { Router } from './router.js';
import { DB } from './db_manager.js';
import { renderSutta } from './renderer.js';
import { getActiveFilters, generateBookParam } from './filters.js';
import { initCommentPopup } from './utils.js';

// Init shared utilities
const { hideComment } = initCommentPopup();

export const SuttaController = {
  /**
   * Logic chính để tải và hiển thị bài kinh.
   * Xử lý cả Lazy Loading và URL Update.
   */
  loadSutta: async function (suttaIdInput, shouldUpdateUrl = true) {
    hideComment();
    
    // 1. Phân tích Input: "mn5#1.2" -> id="mn5", hash="1.2"
    let [baseId, hashPart] = suttaIdInput.split('#');
    const suttaId = baseId.trim().toLowerCase();
    const explicitHash = hashPart ? hashPart : null;

    // 2. Logic Hash & Render Options
    const params = new URLSearchParams(window.location.search);
    const currentUrlId = params.get("q");
    let renderOptions = {};

    if (explicitHash) {
        renderOptions = { highlightId: explicitHash };
    } else {
        const isSamePage = currentUrlId === suttaId;
        renderOptions = { checkHash: isSamePage }; 
    }

    // 3. Helper cập nhật URL
    const doUpdateUrl = () => {
        if (shouldUpdateUrl) {
            Router.updateURL(suttaId, generateBookParam(), false, explicitHash ? `#${explicitHash}` : null);
        }
    };

    // 4. Thử render ngay (nếu data đã có trong RAM)
    if (renderSutta(suttaId, renderOptions)) {
      doUpdateUrl();
      return;
    } 

    // 5. Nếu chưa có, Lazy Load file sách tương ứng
    const bookFile = SuttaLoader.findBookFileFromSuttaId(suttaId);
    if (bookFile) {
        // Tách ID sách từ tên file (ví dụ: 'sutta/mn_book.js' -> 'mn')
        const bookId = bookFile.split('/').pop().replace('_book.js', '').replace('.js', '');
        
        try {
            await SuttaLoader.loadBook(bookId);
            // Render lại sau khi load xong
            if (renderSutta(suttaId, renderOptions)) {
                doUpdateUrl();
            } else {
                // Nếu load file sách xong mà vẫn không render được (ID sai?)
                // Có thể kích hoạt search mode hoặc báo lỗi (Renderer đã xử lý báo lỗi 404)
                console.warn(`Loaded book ${bookId} but could not render ${suttaId}`);
            }
        } catch (err) {
            console.error("Lazy load failed:", err);
            renderSutta(suttaId, renderOptions); // Sẽ hiển thị lỗi 404
        }
    } else {
        // Không tìm thấy file sách nào phù hợp -> 404
        renderSutta(suttaId, renderOptions);
    }
  },

  /**
   * Logic chọn ngẫu nhiên bài kinh dựa trên bộ lọc hiện tại.
   */
  loadRandomSutta: function (shouldUpdateUrl = true) {
    hideComment();
    if (!window.SUTTA_DB) return;

    const allSuttas = DB.getAllAvailableSuttas();
    if (allSuttas.length === 0) return;

    const activePrefixes = getActiveFilters();
    
    // Filter suttas based on active books/prefixes
    const filteredKeys = allSuttas.filter((key) => {
      return activePrefixes.some((prefix) => {
        if (!key.startsWith(prefix)) return false;
        // Đảm bảo ký tự tiếp theo là số (ví dụ: mn1, không phải mn-x)
        const nextChar = key.charAt(prefix.length);
        return /\d/.test(nextChar); 
      });
    });

    if (filteredKeys.length === 0) {
      alert("No suttas match your selected filters!");
      return;
    }

    const randomIndex = Math.floor(Math.random() * filteredKeys.length);
    this.loadSutta(filteredKeys[randomIndex], shouldUpdateUrl);
  }
};