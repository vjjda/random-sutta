// Path: web/assets/modules/tts/index.js
import { TTSManager } from './tts_manager.js';
import { TTSUI } from './ui/index.js';

export const TTSComponent = {
    // [UPDATED] Accept options object
    init(options = {}) {
        // 1. Init Manager First
        TTSManager.init();
        
        // 2. Set Options (callbacks)
        TTSManager.setOptions(options);
        
        // 3. Init UI
        TTSUI.init(TTSManager);
        
        // 4. Connect UI back to Manager
        TTSManager.setUI(TTSUI);
        
        // ... (Popup observer code kept same)
        const observer = new MutationObserver((mutations) => {
            const commentPopup = document.getElementById("comment-popup");
            if (commentPopup && !commentPopup.classList.contains("hidden")) {
                document.body.classList.add("popup-open");
            } else {
                document.body.classList.remove("popup-open");
            }
        });

        const commentPopup = document.getElementById("comment-popup");
        if (commentPopup) {
            observer.observe(commentPopup, { attributes: true, attributeFilter: ['class'] });
        }
    }
};