// Path: web/assets/modules/pali_lookup/lookup_manager.js
import { DictProvider } from './dict_provider.js';
import { LookupUI } from './ui/lookup_ui.js';
import { PaliRenderer } from './utils/pali_renderer.js';
import { getLogger } from 'utils/logger.js';
import { AppConfig } from 'core/app_config.js';

const logger = getLogger("LookupManager");

export const LookupManager = {
    _isNavigating: false,
    _state: { highlightNode: null, currentStart: 0, currentEnd: 0 },

    init() {
        LookupUI.init({
            onClose: () => this.clearSelection(),
            onNavigate: (dir) => this.navigate(dir)
        });
        
        // Initialize Dictionaries in background
        DictProvider.init().then(success => {
             if (success) logger.info("Init", "Dictionaries ready.");
        });
        
        // [UPDATED] Trigger on Click instead of Selection
        document.addEventListener("click", (e) => this._handleClick(e));
        
        // Integration with Global Popup System
        window.addEventListener('popup:close-all', () => {
            LookupUI.hide();
            document.body.classList.remove("lookup-open");
        });
    },

    async _handleClick(e) {
        // Delegate to #sutta-container
        const container = document.getElementById("sutta-container");
        if (!container || !container.contains(e.target)) return;
        
        // Ignore clicks on existing interactive elements (links, buttons)
        if (e.target.closest("a, button, .lookup-highlight")) return;

        // [FIX] Clear previous highlight FIRST to normalize DOM
        // This prevents 'HierarchyRequestError' caused by operating on text nodes
        // that get detached/merged during _clearHighlight's normalization.
        this._clearHighlight();

        // 1. Get Caret Position
        let range;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
            range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.setEnd(pos.offsetNode, pos.offset);
        }

        if (!range || range.startContainer.nodeType !== 3) return; // Must be text node

        const textNode = range.startContainer;
        const offset = range.startOffset;
        const textContent = textNode.textContent;

        // 2. Expand to Word Boundaries
        const delimiters = /[.,;:"'’“”—?!()…\s]/;
        let start = offset;
        let end = offset;

        // Scan Left
        while (start > 0 && !delimiters.test(textContent[start - 1])) {
            start--;
        }
        // Scan Right
        while (end < textContent.length && !delimiters.test(textContent[end])) {
            end++;
        }

        if (start === end) return; // Clicked on delimiter

        const word = textContent.substring(start, end).trim();
        if (!word) return;

        // 3. Highlight (DOM Wrap) the Word
        
        const wordRange = document.createRange();
        wordRange.setStart(textNode, start);
        wordRange.setEnd(textNode, end);

        const span = document.createElement("span");
        span.className = "lookup-highlight";
        try {
            wordRange.surroundContents(span);
        } catch (e) {
            logger.warn("Highlight", "Failed to wrap word", e);
            // Fallback: just continue lookup without highlight
        }

        // [STATE] Store selection state
        this._state = {
            highlightNode: span,
            currentStart: 0, // Reset relative start since node changed
            currentEnd: 0
        };

        // 4. Perform Lookup
        // Note: textNode is now split, but span.parentElement is the context
        this._performLookup(word, span.parentElement);
    },
    
    _clearHighlight() {
        const highlights = document.querySelectorAll('.lookup-highlight');
        highlights.forEach(span => {
            const parent = span.parentNode;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
            // Normalize to merge split text nodes back together
            parent.normalize();
        });
        this._state = { highlightNode: null, currentStart: 0, currentEnd: 0 };
    },
    
    _debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },
    
    async _performLookup(text, contextNode) {
        if (!text) return;
        
        // CLEAN TEXT Logic
        const cleanText = text.toLowerCase().replace(/[.,;:"'’“”—?!()…]/g, '').trim();
        
        if (cleanText.length > 50 || cleanText.length < 1) return; 
        
        // Ensure Dictionaries are ready
        const isReady = await DictProvider.init();
        if (!isReady) return;
        
        // Use DictProvider for search (Pass context parent)
        const results = await DictProvider.search(cleanText, contextNode);
        
        if (results && results.length > 0) {
            const renderData = PaliRenderer.renderList(results, cleanText);
            LookupUI.render(renderData, cleanText); // Send data object + title
            document.body.classList.add("lookup-open");
            
            if (!this._isNavigating) {
                this._scrollToElement(contextNode);
            }
        } else {
            // Not found
            if (this._isNavigating) {
                LookupUI.showError(`"${cleanText}" not found.`);
            }
        }
        
        this._isNavigating = false;
    },
    
    // Legacy _handleSelection removed as we switched to Click
    
    clearSelection() {
        this._clearHighlight();
        document.body.classList.remove("lookup-open");
    },

    navigate(direction) {
        // If we have a highlight node, use it as anchor
        // Note: The highlight node contains the text of the *current* word.
        // We need to look at its siblings to find the next word.
        
        let anchorNode = this._state.highlightNode;
        if (!anchorNode || !anchorNode.isConnected) {
            // Fallback or lost state? 
            // Try finding any highlight
            anchorNode = document.querySelector('.lookup-highlight');
            if (!anchorNode) return;
        }

        // We need the full text context of the parent paragraph/segment
        // But simply getting parentElement.textContent merges everything.
        // Better strategy: Unwrap temporarily to get clean text stream? 
        // OR: Look at PreviousSibling / NextSibling text nodes.
        
        // SIMPLIFIED STRATEGY:
        // 1. Get parent (the segment container)
        const parent = anchorNode.parentElement;
        
        // 2. Re-construct the full text relative to the parent
        // (This is tricky because of the split text nodes)
        // Instead, let's tokenize the parent's full text content
        const fullText = parent.textContent; 
        
        // 3. Find WHERE our current word is in that full text.
        // Since we have multiple identical words, we need to be careful.
        // We can use the childNodes to calculate offset.
        
        let currentOffset = 0;
        let found = false;
        
        for (const node of parent.childNodes) {
            if (node === anchorNode) {
                found = true;
                break;
            }
            currentOffset += node.textContent.length;
        }
        
        if (!found) return; // Should not happen
        
        const currentWordLength = anchorNode.textContent.length;
        const currentCenter = currentOffset + (currentWordLength / 2);

        // 4. Tokenize
        const tokens = this._tokenize(fullText);
        
        // 5. Find token matching our current position
        let currentIndex = -1;
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            const tokenCenter = (t.start + t.end) / 2;
            // Fuzzy match center
            if (Math.abs(tokenCenter - currentCenter) < 2) { // 2px margin for errors
                currentIndex = i;
                break;
            }
        }
        
        if (currentIndex === -1) {
             // Fallback: search by text overlap?
             // Just find closest
             let minDist = Infinity;
             tokens.forEach((t, i) => {
                 const tokenCenter = (t.start + t.end) / 2;
                 const dist = Math.abs(tokenCenter - currentCenter);
                 if (dist < minDist) {
                     minDist = dist;
                     currentIndex = i;
                 }
             });
        }

        // 6. Move Index
        let nextIndex = currentIndex + direction;
        
        // 7. Check Boundary (Jump Segment)
        if (nextIndex < 0) {
            this._jumpSegment(anchorNode, -1);
            return;
        } else if (nextIndex >= tokens.length) {
            this._jumpSegment(anchorNode, 1);
            return;
        }
        
        // 8. Select New Token (Same Segment)
        // We need to map token (start, end) back to DOM nodes.
        // Because of our highlighting, the DOM is fragmented (Text, Span, Text).
        // The easiest way: Clear highlight (Merge nodes) -> Find Range -> Re-highlight.
        
        this._selectTokenInParent(parent, tokens[nextIndex]);
    },

    _tokenize(text) {
        const regex = /[^\s—…]+/g;
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

    _selectTokenInParent(parent, token) {
        this._isNavigating = true;
        
        // 1. Clear existing highlights (Merges text nodes)
        this._clearHighlight();
        
        // 2. Find text node covering [token.start, token.end]
        // Since we normalized, parent should have fewer text nodes (ideally 1 if simple).
        // But there might be other spans (like .eng).
        
        let currentPos = 0;
        let targetNode = null;
        let targetStart = 0;
        let targetEnd = 0;
        
        for (const node of parent.childNodes) {
            const len = node.textContent.length;
            if (currentPos + len > token.start) {
                // Found the node containing the start
                if (node.nodeType === 3) {
                    targetNode = node;
                    targetStart = token.start - currentPos;
                    targetEnd = token.end - currentPos;
                    break;
                } else {
                    // Token is inside another element? Skip complex logic for now
                }
            }
            currentPos += len;
        }
        
        if (targetNode) {
            const range = document.createRange();
            range.setStart(targetNode, targetStart);
            range.setEnd(targetNode, targetEnd);
            
            const span = document.createElement("span");
            span.className = "lookup-highlight";
            try {
                range.surroundContents(span);
                this._state.highlightNode = span;
                
                // Scroll
                this._scrollToElement(span);
                
                // Trigger Lookup
                this._performLookup(token.text, parent);
            } catch (e) {
                logger.warn("Nav Highlight failed", e);
            }
        }
    },
    
    // Alias for compatibility
    _selectToken(node, token) {
        // Not used directly anymore, replaced by _selectTokenInParent logic
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
        
        // [UPDATED] Scroll to the new segment
        // this._scrollToElement(targetWrapper); // Handled by _selectToken now
    },
    
    _scrollToElement(element) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Calculate target Y position: Element Top + Current Scroll - (Viewport Height * Ratio)
        // Ratio = 0.25 means 1/4th from top
        const ratio = AppConfig.LOOKUP?.SCROLL_OFFSET_RATIO || 0.25;
        const targetY = rect.top + scrollTop - (window.innerHeight * ratio);
        
        window.scrollTo({
            top: targetY,
            behavior: 'smooth'
        });
    }
};