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
        document.addEventListener("selectionchange", this._debounce(this._handleSelection.bind(this), 100));
        
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
        const cleanText = text.toLowerCase().replace(/[.,;:"'’“”—?!()]/g, '').trim();
        
        if (cleanText.length > 50 || cleanText.length < 1) return; 
        
        // Ensure DB is ready
        const isReady = await SqliteService.init();
        if (!isReady) return;
        
        // Use smartSearch for multiple results
        const results = await SqliteService.smartSearch(cleanText);
        
        if (results && results.length > 0) {
            const renderData = PaliRenderer.renderList(results, cleanText);
            LookupUI.render(renderData, cleanText); // Send data object + title
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
        
        const anchorNode = sel.anchorNode;
        if (anchorNode.nodeType !== 3) return; // Must be text node
        
        const fullText = anchorNode.textContent;
        const currentStart = Math.min(sel.anchorOffset, sel.focusOffset);
        const currentEnd = Math.max(sel.anchorOffset, sel.focusOffset);

        // 1. Tokenize current node
        const tokens = this._tokenize(fullText);
        
        if (tokens.length === 0) {
            // Empty node, try jumping adjacent?
            this._jumpSegment(anchorNode, direction);
            return;
        }

        // 2. Find Current Token Index
        const center = (currentStart + currentEnd) / 2;
        let currentIndex = -1;
        
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (center >= t.start && center <= t.end) {
                currentIndex = i;
                break;
            }
        }
        
        if (currentIndex === -1) {
            // Find closest
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
        
        // 4. Check Boundary
        if (nextIndex < 0) {
            // Reached START of this segment -> Go to Prev Segment
            this._jumpSegment(anchorNode, -1);
            return;
        } else if (nextIndex >= tokens.length) {
            // Reached END of this segment -> Go to Next Segment
            this._jumpSegment(anchorNode, 1);
            return;
        }
        
        // 5. Select New Token (Same Segment)
        this._selectToken(anchorNode, tokens[nextIndex]);
    },

    _tokenize(text) {
        // Tokenize by Whitespace AND Em-dash
        const regex = /[^\s—]+/g;
        let match;
        const tokens = [];
        while ((match = regex.exec(text)) !== null) {
            tokens.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        return tokens;
    },

    _selectToken(node, token) {
        this._isNavigating = true;
        const sel = window.getSelection();
        const newRange = document.createRange();
        newRange.setStart(node, token.start);
        newRange.setEnd(node, token.end);
        
        sel.removeAllRanges();
        sel.addRange(newRange);
        
        // Scroll into view if needed?
        // const span = node.parentElement;
        // if (span) span.scrollIntoView({behavior: "smooth", block: "center"});
    },

    _jumpSegment(currentNode, direction) {
        // 1. Find the wrapper .segment
        let currentWrapper = currentNode.parentElement;
        // Ensure we are inside a .pli span
        if (!currentWrapper.classList.contains('pli')) {
            // Maybe we clicked directly on .segment text? (Unlikely with structure)
            // Or maybe traversing up
            const pli = currentWrapper.querySelector('.pli');
            if (pli) currentWrapper = pli; // If we were at segment level, go down
            else {
                // Should be inside .pli
                currentWrapper = currentWrapper.closest('.pli');
            }
        }

        if (!currentWrapper) return;
        
        // Get all .pli spans in the container to find index
        // This is reasonably fast
        const allSegments = Array.from(document.querySelectorAll('#sutta-container .pli'));
        const currentIdx = allSegments.indexOf(currentWrapper);
        
        if (currentIdx === -1) return;
        
        const nextIdx = currentIdx + direction;
        if (nextIdx < 0 || nextIdx >= allSegments.length) {
            // End of document
            return; 
        }
        
        const targetWrapper = allSegments[nextIdx];
        
        // Assume text is first child or text content
        // Usually .pli contains just text
        const targetNode = targetWrapper.firstChild;
        if (!targetNode || targetNode.nodeType !== 3) return;
        
        const tokens = this._tokenize(targetNode.textContent);
        if (tokens.length === 0) return; // Empty segment?
        
        // If moving Forward (Next) -> Select FIRST token of next segment
        // If moving Backward (Prev) -> Select LAST token of prev segment
        const targetToken = (direction === 1) ? tokens[0] : tokens[tokens.length - 1];
        
        this._selectToken(targetNode, targetToken);
        
        // Scroll to the new segment
        targetWrapper.scrollIntoView({behavior: "smooth", block: "center"});
    }
};