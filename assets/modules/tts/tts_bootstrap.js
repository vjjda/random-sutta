// Path: web/assets/modules/tts/tts_bootstrap.js
import { TTSOrchestrator } from './core/tts_orchestrator.js';
import { TTSUICoordinator } from './ui/tts_ui_coordinator.js';

export const TTSBootstrap = {
    init(options = {}) {
        // 1. Core Logic
        TTSOrchestrator.init();
        TTSOrchestrator.setCallbacks(options);

        // 2. UI
        TTSUICoordinator.init(TTSOrchestrator);

        // 3. Connect UI -> Core
        TTSOrchestrator.setUI(TTSUICoordinator);
        
        // 4. Global Observers (Legacy logic for popup conflict)
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