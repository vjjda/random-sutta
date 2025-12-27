// Path: web/assets/modules/lookup/core/lookup_highlighter.js
import { getLogger } from 'utils/logger.js';
import { LookupState } from './lookup_state.js';
import { AppConfig } from 'core/app_config.js';

const logger = getLogger("LookupHighlighter");

export const LookupHighlighter = {
    clearHighlight() {
        const highlights = document.querySelectorAll('.lookup-highlight');
        highlights.forEach(span => {
            const parent = span.parentNode;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
            parent.normalize();
        });
        LookupState.reset();
    },

    highlightRange(range) {
        // Clear previous first
        this.clearHighlight();

        const span = document.createElement("span");
        span.className = "lookup-highlight";
        try {
            range.surroundContents(span);
            // Update State
            LookupState.setHighlight(span, 0, 0); 
            return span;
        } catch (e) {
            logger.warn("Highlight", "Failed to wrap word", e);
            return null;
        }
    },

    scrollToElement(element) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        const ratio = AppConfig.LOOKUP?.SCROLL_OFFSET_RATIO || 0.25;
        const targetY = rect.top + scrollTop - (window.innerHeight * ratio);
        
        window.scrollTo({
            top: targetY,
            behavior: 'smooth'
        });
    }
};