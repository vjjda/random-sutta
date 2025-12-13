// Path: web/assets/modules/tts/ui/tts_ui_coordinator.js
import { TTSUILayout } from './tts_ui_layout.js';
import { TTSUIRenderer } from './tts_ui_renderer.js';
import { TTSUIActions } from './tts_ui_actions.js';
import { AppConfig } from '../../core/app_config.js'; // [NEW]

export const TTSUICoordinator = {
    orchestrator: null,

    init(orchestratorInstance) {
        this.orchestrator = orchestratorInstance;
        TTSUILayout.inject();
        TTSUIRenderer.cacheElements();
        
        // [NEW] Apply UI Config (Padding)
        this._applyConfig();

        TTSUIActions.bind(this.orchestrator, TTSUIRenderer);
        
        // Listen to Engine updates
        this.orchestrator.engine.onVoicesChanged = (voices) => {
            TTSUIRenderer.populateVoices(voices, this.orchestrator.engine.voice);
        };

        // Sync Initial Settings
        setTimeout(() => {
             TTSUIRenderer.populateVoices(
                 this.orchestrator.engine.getVoices(), 
                 this.orchestrator.engine.voice
             );
             TTSUIRenderer.updateRateDisplay(this.orchestrator.engine.rate);
        }, 500);
    },

    // [NEW] Hàm áp dụng config padding
    _applyConfig() {
        const paddingVal = AppConfig.TTS?.BOTTOM_PADDING;
        if (paddingVal) {
            const container = document.getElementById('sutta-container');
            if (container) {
                container.style.paddingBottom = paddingVal;
            }
        }
    },

    // Delegate methods
    updatePlayState(isPlaying) { TTSUIRenderer.updatePlayState(isPlaying); },
    updateInfo(current, total) { TTSUIRenderer.updateInfo(current, total); },
    updateStatus(text) { TTSUIRenderer.updateStatus(text); },
    updateAutoNextState(isChecked) { TTSUIRenderer.updateAutoNextState(isChecked); },
    togglePlayer(show) { TTSUIRenderer.togglePlayer(show); }, // Expose toggle for orchestrator
    closeSettings() { TTSUIRenderer.closeSettings(); } // Expose close settings
};