// Path: web/assets/modules/lookup/lookup_manager.js
import { DictProvider } from './dict_provider.js';
import { LookupUI } from './ui/lookup_ui.js';
import { PaliMainRenderer as PaliRenderer } from './renderers/pali/pali_main_renderer.js';
import { getLogger } from 'utils/logger.js';

import { LookupEventHandler } from './core/lookup_event_handler.js';
import { LookupNavigator } from './core/lookup_navigator.js';
import { LookupHighlighter } from './core/lookup_highlighter.js';
import { LookupState } from './core/lookup_state.js';

const logger = getLogger("LookupManager");

export const LookupManager = {
    init() {
        // UI Callbacks
        LookupUI.init({
            onClose: () => this.clearHighlight(),
            onNavigate: (dir) => LookupNavigator.navigate(dir, this._performLookup.bind(this))
        });
        
        // Initialize Dictionaries
        DictProvider.init().then(success => {
             if (success) logger.info("Init", "Dictionaries ready.");
        });
        
        // Click Event (Delegated)
        document.addEventListener("click", (e) => 
            LookupEventHandler.handleClick(e, this._performLookup.bind(this))
        );
        
        // Keyboard Navigation
        document.addEventListener("keydown", (e) => {
            const lookupEl = document.getElementById("lookup-popup");
            if (LookupUI.isVisible() && lookupEl && lookupEl.classList.contains("is-top-layer")) {
                if (e.key === "ArrowLeft") LookupNavigator.navigate(-1, this._performLookup.bind(this));
                if (e.key === "ArrowRight") LookupNavigator.navigate(1, this._performLookup.bind(this));
            }
        });
        
        // Global Integration
        window.addEventListener('popup:close-all', () => {
            LookupUI.hide();
            document.body.classList.remove("lookup-open");
        });
    },

    async _performLookup(text, contextNode) {
        if (!text) return;
        
        // [CONTEXT] Capture Segment Text for Best Match Logic
        let segmentText = "";
        if (contextNode) {
            // Try to find the closest segment container (usually has class 'segment' or id)
            // Fallback to parent element if no specific segment class found
            const segment = contextNode.closest(".segment") || contextNode.closest("p") || contextNode.parentElement;
            if (segment) segmentText = segment.textContent;
        }

        // Clean Text
        // [UPDATED] Include all smart quotes
        const cleanText = text.toLowerCase().replace(/[.,;:"'‘’“”\—?!()…]/g, '').trim();
        
        if (cleanText.length > 50 || cleanText.length < 1) return; 
        
        // Ensure Dictionaries are ready
        const isReady = await DictProvider.init();
        if (!isReady) return;
        
        // Search
        const results = await DictProvider.search(cleanText, contextNode);
        
        if (results && results.length > 0) {
            const renderData = PaliRenderer.renderList(results, cleanText);
            LookupUI.render(renderData, cleanText, segmentText, results); 
            document.body.classList.add("lookup-open");

            // [STACKING] Bring to Front
            const lookupEl = document.getElementById("lookup-popup");
            const commentEl = document.getElementById("comment-popup");
            if (lookupEl) lookupEl.classList.add("is-top-layer");
            if (commentEl) commentEl.classList.remove("is-top-layer");
            
            // Auto Scroll (only if first look, not nav)
            if (!LookupState.isNavigating) {
                LookupHighlighter.scrollToElement(contextNode, true);
            }
        } else {
            // Not found
            // Only show error if explicitly navigating or clicking, maybe?
            // Current behavior: show error in popup if popup is open or navigating
            if (LookupState.isNavigating || LookupUI.isVisible()) {
                LookupUI.showError(`"${cleanText}" not found.`, cleanText);
            }
        }
        
        // Reset Nav Flag
        LookupState.isNavigating = false;
    },
    
    clearHighlight() {
        LookupHighlighter.clearHighlight();
        document.body.classList.remove("lookup-open");
        
        // [STACKING] When closing, yield 'top-layer' status back to Comment if open
        const lookupEl = document.getElementById("lookup-popup");
        if (lookupEl) lookupEl.classList.remove("is-top-layer");

        const commentEl = document.getElementById("comment-popup");
        // Check if comment popup is visible (not hidden)
        if (commentEl && !commentEl.classList.contains("hidden")) {
            commentEl.classList.add("is-top-layer");
        }
    }
};