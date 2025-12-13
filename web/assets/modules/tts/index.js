// Path: web/assets/modules/tts/index.js
import { TTSManager } from './tts_manager.js';
import { TTSUI } from './tts_ui.js';

export const TTSComponent = {
    init() {
        TTSUI.init(TTSManager);
        TTSManager.init(TTSUI);
        
        // Listen to Popup events to toggle visibility of trigger
        // (Đây là giải pháp tạm, tốt hơn là dùng MutationObserver hoặc Event Bus)
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