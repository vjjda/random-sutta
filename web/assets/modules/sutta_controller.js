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
    const bookFile = SuttaLoader.findBookFileFromSuttaId(suttaId);
    if (bookFile) {
        const dbKey = bookFile.replace(/_book\.js$/, '').replace(/\//g, '_');
        if (!window.SUTTA_DB || !window.SUTTA_DB[dbKey]) {
             const bookId = bookFile.split('/').pop().replace('_book.js', '').replace('.js', '');
             try {
                 logger.debug(`Lazy loading book: ${bookId}`);
                 await SuttaLoader.loadBook(bookId);
                 return this.loadSutta(suttaIdInput, shouldUpdateUrl, scrollY, options);
             } catch (err) {
                 logger.error(`Lazy load failed for ${bookId}`, err);
             }
        }
    }

    // 3. Shortcut Logic
    const meta = DB.getMeta(suttaId);
    if (meta && meta.type === 'shortcut') {
        const parentId = meta.parent_uid;
        logger.debug(`Shortcut detected: ${suttaId} -> ${parentId}`);
        
        const targetScrollId = meta.scroll_target;
        const shouldDisableHighlight = meta.is_implicit === true;

        options.highlightId = targetScrollId;
        options.noHighlight = shouldDisableHighlight;
        
        return this.loadSutta(`${parentId}#${targetScrollId || ''}`, shouldUpdateUrl, scrollY, options);
    }

    // 4. Prepare Render Action
    const performRender = () => {
        const success = renderSutta(suttaId, { ...options });
        if (success && shouldUpdateUrl) {
             const finalHash = explicitHash ? `#${explicitHash}` : '';
             Router.updateURL(suttaId, null, false, finalHash, currentScrollBeforeRender);
        }
        return success;
    };

    // 5. Execution Strategy
    let targetScrollId = explicitHash;
    if (!targetScrollId && options.highlightId) {
        targetScrollId = options.highlightId.replace('#', '');
    }
    if (!targetScrollId) {
        const m = DB.getMeta(suttaId);
        if (m && m.scroll_target) targetScrollId = m.scroll_target;
    }

    if (isTransition) {
        await Scroller.transitionTo(performRender, targetScrollId);
    } else {
        performRender();
        // Xử lý Scroll ngay lập tức
        if (targetScrollId) {
            setTimeout(() => Scroller.scrollToId(targetScrollId), 0);
        } else if (scrollY > 0) {
            // [FIX] Thêm behavior instant
            window.scrollTo({ top: scrollY, behavior: 'instant' });
        } else {
            // [FIX] Thêm behavior instant
            window.scrollTo({ top: 0, behavior: 'instant' });
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
    this.loadSutta(target, shouldUpdateUrl, 0, { transition: false });
  }
};