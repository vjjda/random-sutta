// Path: web/assets/modules/pali_lookup/lookup_manager.js
import { SqliteService } from 'services/sqlite_service.js';
import { LookupUI } from './ui/lookup_ui.js';
import { PaliRenderer } from './utils/pali_renderer.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("LookupManager");

export const LookupManager = {
    init() {
        LookupUI.init({
            onClose: () => this.clearSelection()
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
        
        // Optional: Check if we are selecting English or Pali?
        // DPD is Pali-English. If user selects English, it probably won't match.
        
        // Clean text
        // remove punctuation
        const cleanText = text.toLowerCase().replace(/[.,;:"'’“”]/g, '').trim();
        
        if (cleanText.length > 40 || cleanText.length < 2) return; 
        
        // Ensure DB is ready
        const isReady = await SqliteService.init();
        if (!isReady) return;
        
        const result = SqliteService.search(cleanText);
        if (result) {
            // Found!
            // Close other popups first
            window.dispatchEvent(new CustomEvent('popup:close-all'));
            
            const html = PaliRenderer.render(result);
            LookupUI.render(html, `Lookup: ${cleanText}`);
        } else {
            // Not found - do nothing (don't disturb user)
        }
    },
    
    clearSelection() {
        window.getSelection()?.removeAllRanges();
    }
};
