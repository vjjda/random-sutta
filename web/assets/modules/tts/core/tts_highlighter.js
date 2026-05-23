// Path: web/assets/modules/tts/core/tts_highlighter.js
import { TTSStateStore } from './tts_state_store.js';
import { Scroller } from 'ui/common/scroller.js';

export const TTSHighlighter = {
    ui: null, // Tham chiếu tới UI để cập nhật số đếm (1/10)

    setUI(uiInstance) {
        this.ui = uiInstance;
    },

    activate(index) {
        const item = TTSStateStore.playlist[index];
        if (!item) return;

        // 1. Highlight Element
        this._applyClass(item.element, item.blockElement);
        
        // 2. Scroll
        // [FIX] Pass the element directly. 
        // Virtual IDs (from split paragraphs) won't exist in DOM, but item.element is always valid.
        // If it's a granular chunk, we scroll to its specific element (Segment or Span).
        Scroller.scrollToReadingPosition(item.element || item.id);
        
        // 3. Update Counter UI
        if (this.ui) {
            this.ui.updateInfo(index + 1, TTSStateStore.playlist.length);
        }
    },

    clear() {
        this._applyClass(null, null); // Clear all
    },

    _applyClass(activeEl, blockEl) {
        document.querySelectorAll(".tts-active, .tts-block-active").forEach(e => {
            e.classList.remove("tts-active", "tts-block-active");
        });
        if (activeEl) activeEl.classList.add("tts-active");
        
        // Apply block highlight if different from activeEl
        if (blockEl && blockEl !== activeEl) {
            blockEl.classList.add("tts-block-active");
        }
    }
};