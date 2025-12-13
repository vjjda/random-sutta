// Path: web/assets/modules/tts/index.js
import { TTSManager } from './tts_manager.js';
import { TTSUI } from './tts_ui.js';

export const TTSComponent = {
    init() {
        // [FIXED] Order of initialization logic
        
        // 1. Init Manager First (Create Engine)
        TTSManager.init();
        
        // 2. Init UI (Inject HTML, Bind Events, Bind Engine Listeners)
        TTSUI.init(TTSManager);
        
        // 3. Connect UI back to Manager
        TTSManager.setUI(TTSUI);
        
        // Listen to Popup events to toggle visibility of trigger
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