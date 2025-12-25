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
            document.body.classList.remove("lookup-open");
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
        
        // CLEAN TEXT Logic
        // Remove punctuation including Pali specific ones (” “ ’)
        // [UPDATED] Also remove em-dash if it somehow got selected (though nav tries to avoid it)
        const cleanText = text.toLowerCase().replace(/[.,;:"'’“”—]/g, '').trim();
        
        if (cleanText.length > 50 || cleanText.length < 1) return; 
        
        // Ensure DB is ready
        const isReady = await SqliteService.init();
        if (!isReady) return;
        
        const result = SqliteService.search(cleanText);
        
        if (result) {
            const html = PaliRenderer.render(result);
            LookupUI.render(html, cleanText); // Send cleanText as title
            document.body.classList.add("lookup-open");
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
        document.body.classList.remove("lookup-open");
    },

    navigate(direction) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        
        // We assume we are working within a single Text Node for Pali segments
        const anchorNode = sel.anchorNode;
        if (anchorNode.nodeType !== 3) return; // Must be text node
        
        const fullText = anchorNode.textContent;
        const currentStart = Math.min(sel.anchorOffset, sel.focusOffset);
        const currentEnd = Math.max(sel.anchorOffset, sel.focusOffset);

        // 1. Tokenize by Whitespace AND Em-dash
        // Regex matches sequences of characters that are NOT whitespace and NOT em-dash
        const regex = /[^\s—]+/g;
        let match;
        const tokens = [];
        
        while ((match = regex.exec(fullText)) !== null) {
            tokens.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        if (tokens.length === 0) return;

        // 2. Find Current Token Index
        // Determine which token overlaps with the current selection center
        const center = (currentStart + currentEnd) / 2;
        let currentIndex = -1;
        
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            // Check if center is within token bounds
            if (center >= t.start && center <= t.end) {
                currentIndex = i;
                break;
            }
        }
        
        // If not found (e.g. user selected multiple words or spaces), find closest
        if (currentIndex === -1) {
            let minDist = Infinity;
            tokens.forEach((t, i) => {
                const dist = Math.abs(center - (t.start + t.end) / 2);
                if (dist < minDist) {
                    minDist = dist;
                    currentIndex = i;
                }
            });
        }
        
        // 3. Move Index
        let nextIndex = currentIndex + direction;
        
        // Bounds check
        if (nextIndex < 0) nextIndex = 0; 
        if (nextIndex >= tokens.length) nextIndex = tokens.length - 1;
        
        if (nextIndex === currentIndex && !this._isNavigating) return; // Nowhere to go

        // 4. Select New Token
        this._isNavigating = true;
        const targetToken = tokens[nextIndex];
        
        const newRange = document.createRange();
        newRange.setStart(anchorNode, targetToken.start);
        newRange.setEnd(anchorNode, targetToken.end);
        
        sel.removeAllRanges();
        sel.addRange(newRange);
    }
};
