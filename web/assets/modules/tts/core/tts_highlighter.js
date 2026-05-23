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

        // 1. Highlight Elements
        // item.elements may contain multiple segments for a paragraph chunk
        const activeEls = item.elements || (item.element ? [item.element] : []);
        this._applyClass(activeEls, item.blockElement);
        
        // 2. Scroll
        // We scroll to the primary element of the item
        Scroller.scrollToReadingPosition(item.element || item.id);
        
        // 3. Update Counter UI
        if (this.ui) {
            this.ui.updateInfo(index + 1, TTSStateStore.playlist.length);
        }
    },

    clear() {
        this._applyClass([], null); // Clear all
    },

    _applyClass(activeEls, blockEl) {
        document.querySelectorAll(".tts-active, .tts-block-active").forEach(e => {
            e.classList.remove("tts-active", "tts-block-active");
        });

        if (activeEls.length === 0) return;

        // 1. Mark active ones
        activeEls.forEach(el => {
            if (el) el.classList.add("tts-active");
        });

        // 2. [NEW] Fill visual gaps between active elements for continuity
        // This handles .no-trans segments or markers interleaved between active segments
        if (activeEls.length > 1) {
            const first = activeEls[0];
            const last = activeEls[activeEls.length - 1];
            
            // Only fill if they share the same parent to avoid over-highlighting across blocks
            if (first.parentElement === last.parentElement) {
                let current = first.nextElementSibling;
                while (current && current !== last) {
                    current.classList.add("tts-active");
                    current = current.nextElementSibling;
                }
            }
        }
        
        // 3. Apply block highlight if different from active elements
        if (blockEl && !activeEls.includes(blockEl)) {
            blockEl.classList.add("tts-block-active");
        }
    }
};