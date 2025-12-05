// Path: web/assets/modules/sutta_controller.js
import { SuttaLoader } from './loader.js';
import { Router } from './router.js';
import { DB } from './db_manager.js';
import { renderSutta } from './renderer.js';
import { getActiveFilters, generateBookParam } from './filters.js';
import { initCommentPopup } from './utils.js';

const { hideComment } = initCommentPopup();

export const SuttaController = {
  loadSutta: async function (suttaIdInput, shouldUpdateUrl = true) {
    hideComment();
    
    let [baseId, hashPart] = suttaIdInput.split('#');
    const suttaId = baseId.trim().toLowerCase();
    const explicitHash = hashPart ? hashPart : null;

    const params = new URLSearchParams(window.location.search);
    const currentUrlId = params.get("q");
    
    // Default Options
    let renderOptions = {};
    if (explicitHash) {
        renderOptions = { highlightId: explicitHash };
    } else {
        const isSamePage = currentUrlId === suttaId;
        renderOptions = { checkHash: isSamePage }; 
    }

    const doUpdateUrl = (idToUrl) => {
        if (shouldUpdateUrl) {
            Router.updateURL(idToUrl, generateBookParam(), false, explicitHash ? `#${explicitHash}` : null);
        }
    };

    // --- SHORTCUT LOGIC ---
    const meta = DB.getMeta(suttaId);
    if (meta && meta.type === 'shortcut') {
        const parentId = meta.parent_uid;
        
        // [FIX] Bỏ "|| parentId". 
        // Nếu scroll_target là null (do Python lọc), ta tôn trọng nó -> Không scroll.
        // Renderer.js sẽ tự động window.scrollTo(0, 0) nếu targetId là null.
        const targetScrollId = meta.scroll_target; 

        const shouldDisableHighlight = meta.is_implicit === true;

        const success = renderSutta(parentId, {
            highlightId: targetScrollId,
            noHighlight: shouldDisableHighlight,
            checkHash: false 
        });

        if (success) {
            doUpdateUrl(suttaId); 
            return;
        }
    }
    // -----------------------------

    // Normal Render Logic
    if (renderSutta(suttaId, renderOptions)) {
      doUpdateUrl(suttaId);
      return;
    } 

    // Lazy Load Logic
    const bookFile = SuttaLoader.findBookFileFromSuttaId(suttaId);
    if (bookFile) {
        // [FIX] Infinite Loop Guard
        const dbKey = bookFile.replace(/_book\.js$/, '').replace(/\//g, '_');
        
        if (window.SUTTA_DB && window.SUTTA_DB[dbKey]) {
             console.warn(`🛑 Infinite Loop detected: Book '${dbKey}' is loaded but does not contain '${suttaId}'.`);
             renderSutta(suttaId, renderOptions); // Hiển thị 404
             return;
        }

        const bookId = bookFile.split('/').pop().replace('_book.js', '').replace('.js', '');
        
        try {
            await SuttaLoader.loadBook(bookId);
            // Sau khi load xong, gọi đệ quy lại chính hàm này
            this.loadSutta(suttaIdInput, shouldUpdateUrl);
        } catch (err) {
            console.error("Lazy load failed:", err);
            renderSutta(suttaId, renderOptions);
        }
    } else {
        renderSutta(suttaId, renderOptions);
    }
  },

  loadRandomSutta: function (shouldUpdateUrl = true) {
    // ... (Giữ nguyên logic random) ...
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
    this.loadSutta(filteredKeys[randomIndex], shouldUpdateUrl);
  }
};