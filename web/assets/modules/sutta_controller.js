// Path: web/assets/modules/sutta_controller.js
import { SuttaLoader } from './loader.js';
import { Router } from './router.js';
import { DB } from './db_manager.js';
import { renderSutta } from './renderer.js';
import { getActiveFilters } from './filters.js';
import { initCommentPopup } from './utils.js';
// [NEW]
import { getLogger } from './logger.js';

const logger = getLogger("SuttaController");
const { hideComment } = initCommentPopup();

export const SuttaController = {
  loadSutta: async function (suttaIdInput, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    // ... (Giữ nguyên logic scroll) ...
    const currentScrollBeforeRender = window.scrollY;
    hideComment();
    
    // --- 1. DEFINITIONS ---
    const doUpdateUrl = (idToUrl) => {
        if (shouldUpdateUrl) {
            const parts = suttaIdInput.split('#');
            const explicitHash = parts.length > 1 ? `#${parts[1]}` : null;
            Router.updateURL(idToUrl, null, false, explicitHash, currentScrollBeforeRender);
        }
    };

    // --- 2. PARSE INPUT ---
    let [baseId, hashPart] = suttaIdInput.split('#');
    const suttaId = baseId.trim().toLowerCase();
    const explicitHash = hashPart ? hashPart : null;
    
    // [LOGGING]
    logger.info(`Request to load: ${suttaId} ${explicitHash ? `(Hash: ${explicitHash})` : ''}`);
    
    // ... (Giữ nguyên params) ...
    const params = new URLSearchParams(window.location.search);
    const currentUrlId = params.get("q");

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
        logger.debug(`Shortcut detected: ${suttaId} -> ${parentId}`);
        
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
             logger.warn(`Infinite Loop detected: Book '${dbKey}' loaded but '${suttaId}' missing.`);
             renderSutta(suttaId, renderOptions);
             return;
        }

        const bookId = bookFile.split('/').pop().replace('_book.js', '').replace('.js', '');
        try {
            logger.debug(`Lazy loading book: ${bookId} for ${suttaId}`);
            await SuttaLoader.loadBook(bookId);
            this.loadSutta(suttaIdInput, shouldUpdateUrl, scrollY, options);
        } catch (err) {
            logger.error(`Lazy load failed for ${bookId}`, err);
            renderSutta(suttaId, renderOptions);
        }
    } else {
        logger.warn(`No book file found for ${suttaId}`);
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
    const target = filteredKeys[randomIndex];
    
    logger.info(`Random selection: ${target} (Pool: ${filteredKeys.length})`);
    this.loadSutta(target, shouldUpdateUrl);
  }
};