// Path: web/assets/modules/sutta_controller.js
import { SuttaLoader } from './loader.js';
import { Router } from './router.js';
import { DB } from './db_manager.js';
import { renderSutta } from './renderer.js';
import { getActiveFilters, generateBookParam } from './filters.js';
import { initCommentPopup } from './utils.js';

const { hideComment } = initCommentPopup();

export const SuttaController = {
  loadSutta: async function (suttaIdInput, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    const currentScrollBeforeRender = window.scrollY;
    hideComment();
    
    // --- 1. DEFINITIONS ---
    const doUpdateUrl = (idToUrl) => {
        if (shouldUpdateUrl) {
            // [FIX] Luôn lấy hash từ input đầu vào (suttaIdInput)
            // suttaIdInput lúc này là "mn38#35.1" do bên utils.js truyền sang
            const parts = suttaIdInput.split('#');
            const explicitHash = parts.length > 1 ? `#${parts[1]}` : null;
            
            // Truyền explicitHash vào Router để nó gắn lên URL
            Router.updateURL(idToUrl, generateBookParam(), false, explicitHash, currentScrollBeforeRender);
        }
    };

    // --- 2. PARSE INPUT ---
    let [baseId, hashPart] = suttaIdInput.split('#');
    const suttaId = baseId.trim().toLowerCase();
    const explicitHash = hashPart ? hashPart : null;
    
    const params = new URLSearchParams(window.location.search);
    const currentUrlId = params.get("q");

    // --- 3. RENDER OPTIONS ---
    let renderOptions = { ...options };

    if (explicitHash) {
        renderOptions.highlightId = explicitHash;
    } else {
        const isSamePage = currentUrlId === suttaId;
        renderOptions.checkHash = isSamePage;
        renderOptions.restoreScroll = scrollY;
    }

    // --- 4. SHORTCUT LOGIC ---
    const meta = DB.getMeta(suttaId);
    if (meta && meta.type === 'shortcut') {
        const parentId = meta.parent_uid;
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

    // --- 5. NORMAL RENDER LOGIC ---
    if (renderSutta(suttaId, renderOptions)) {
      doUpdateUrl(suttaId); 
      return;
    } 

    // --- 6. LAZY LOAD LOGIC ---
    const bookFile = SuttaLoader.findBookFileFromSuttaId(suttaId);
    if (bookFile) {
        const dbKey = bookFile.replace(/_book\.js$/, '').replace(/\//g, '_');
        if (window.SUTTA_DB && window.SUTTA_DB[dbKey]) {
             console.warn(`🛑 Infinite Loop detected: Book '${dbKey}' is loaded but does not contain '${suttaId}'.`);
             renderSutta(suttaId, renderOptions);
             return;
        }

        const bookId = bookFile.split('/').pop().replace('_book.js', '').replace('.js', '');
        try {
            await SuttaLoader.loadBook(bookId);
            this.loadSutta(suttaIdInput, shouldUpdateUrl, scrollY, options);
        } catch (err) {
            console.error("Lazy load failed:", err);
            renderSutta(suttaId, renderOptions);
        }
    } else {
        renderSutta(suttaId, renderOptions);
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
    this.loadSutta(filteredKeys[randomIndex], shouldUpdateUrl);
  }
};