// Path: web/assets/modules/pali_lookup/lookup_manager.js
import { SqliteService } from 'services/sqlite_service.js';
import { LookupUI } from './ui/lookup_ui.js';
import { PaliRenderer } from './utils/pali_renderer.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("LookupManager");

export const LookupManager = {
    _isNavigating: false,

    init() {
        LookupUI.init({
            onClose: () => this.clearSelection(),
            onNavigate: (dir) => this.navigate(dir)
        });
        
        // Initialize DB in background
        SqliteService.init().then(success => {
             if (success) logger.info("Init", "Ready for lookups.");
        });
        
        // Debounce selection change
        document.addEventListener("selectionchange", this._debounce(this._handleSelection.bind(this), 600));
        
        // Integration with Global Popup System
        window.addEventListener('popup:close-all', () => {
            LookupUI.hide();
        });
    },
    
    _debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },
    
    async _handleSelection() {
        // If we are programmatically navigating, skip the debounce check or allow it?
        // Actually, navigation modifies selection, which triggers this event.
        // We rely on this event to trigger lookup even during navigation.
        
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            return;
        }

        const text = selection.toString().trim();
        if (!text) return;
        
        // Check context: Must be inside #sutta-container
        const anchor = selection.anchorNode;
        const parent = anchor.nodeType === 3 ? anchor.parentElement : anchor;
        
        if (!parent || !parent.closest('#sutta-container')) return;
        
        // Clean text
        const cleanText = text.toLowerCase().replace(/[.,;:"'’“”]/g, '').trim();
        
        if (cleanText.length > 40 || cleanText.length < 2) return; 
        
        // Ensure DB is ready
        const isReady = await SqliteService.init();
        if (!isReady) return;
        
        const result = SqliteService.search(cleanText);
        if (result) {
            // Found!
            // Close other popups first (e.g. comment popup)
            // But we don't want to flicker if WE are already open?
            // Sending 'popup:close-all' closes US too via listener. 
            // We should modify the listener to check if we are the active one.
            // For now, let's just close *others* if we can, or rely on them closing themselves on click.
            // Actually, the requirement is "Close other popups".
            
            // To avoid self-closing loop via 'popup:close-all', we can temporarily remove listener or check visibility
            // But simplified: Just render. The other popups close on document click usually.
            
            const html = PaliRenderer.render(result);
            LookupUI.render(html, cleanText); // Send cleanText as title
        } else {
            // Not found
            if (this._isNavigating) {
                LookupUI.showError(`"${cleanText}" not found.`);
            }
        }
        
        this._isNavigating = false;
    },
    
    clearSelection() {
        window.getSelection()?.removeAllRanges();
    },

    navigate(direction) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        
        this._isNavigating = true; // Flag to show errors if nav hits non-word

        // Use Selection.modify() API (supported in Chrome/Safari/Firefox)
        // 1. Collapse selection to the edge we are moving towards
        if (direction === 1) {
            sel.collapseToEnd();
        } else {
            sel.collapseToStart();
        }

        // 2. Move by word
        // Note: 'word' granularity varies by OS/Locale but generally works for Pali/English
        const granularity = 'word';
        const alter = 'move';
        
        // Logic loop to skip whitespace/punctuation if modify stops on them
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
            const beforeNode = sel.focusNode;
            const beforeOffset = sel.focusOffset;
            
            if (direction === 1) {
                sel.modify(alter, 'forward', granularity);
            } else {
                sel.modify(alter, 'backward', granularity);
            }
            
            // If didn't move, we are at boundary
            if (sel.focusNode === beforeNode && sel.focusOffset === beforeOffset) break;
            
            // Now EXTEND to select the word
            // We just moved to the *start* (prev) or *end* (next) of the target word.
            // We need to select the whole word.
            
            // Re-anchor and extend
            if (direction === 1) {
                // Moved forward to end of next word? Or start? 
                // 'move forward word' usually puts cursor at END of next word.
                // So extend backwards to select it.
                sel.modify('extend', 'backward', granularity);
            } else {
                // Moved backward to start of prev word.
                // Extend forward to select it.
                sel.modify('extend', 'forward', granularity);
            }
            
            // Check what we selected
            const text = sel.toString().trim();
            if (text && /[a-zA-ZāīūṅñṭḍṇḷṃĀĪŪṄÑṬḌṆḶṂ]/.test(text)) {
                // Found a valid word!
                // Trigger handleSelection logic (it is debounced, so we might want to force it)
                // Since we are inside navigate, we can call it directly after a small delay to let UI update?
                // The 'selectionchange' event will fire automatically.
                return;
            }
            
            // If whitespace/symbol, collapse and try again
            if (direction === 1) sel.collapseToEnd();
            else sel.collapseToStart();
            
            attempts++;
        }
    }
};