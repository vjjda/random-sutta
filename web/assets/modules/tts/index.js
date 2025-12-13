// Path: web/assets/modules/tts/index.js
import { TTSManager } from './tts_manager.js';
import { TTSUI } from './ui/index.js'; // [UPDATED] Point to UI folder

export const TTSComponent = {
    init() {
        TTSManager.init();
        TTSUI.init(TTSManager);
        TTSManager.setUI(TTSUI);
        
        // Listen to Popup events (Legacy logic)
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