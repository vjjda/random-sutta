// Path: web/assets/modules/tts/ui/tts_ui_coordinator.js
import { TTSUILayout } from './tts_ui_layout.js';
import { TTSUIRenderer } from './tts_ui_renderer.js';
import { TTSUIActions } from './tts_ui_actions.js';
import { AppConfig } from '../../core/app_config.js';

export const TTSUICoordinator = {
    orchestrator: null,

    init(orchestratorInstance) {
        this.orchestrator = orchestratorInstance;
        TTSUILayout.inject();
        TTSUIRenderer.cacheElements();
        
        // [UPDATED] Apply CSS Variable for Padding
        this._applyConfig();

        TTSUIActions.bind(this.orchestrator, TTSUIRenderer);
        
        // Orchestrator handles onVoicesChanged and initial population
    },

    // [UPDATED] Set CSS Variable
    _applyConfig() {
        const paddingVal = AppConfig.TTS?.BOTTOM_PADDING;
        if (paddingVal) {
            document.documentElement.style.setProperty('--tts-bottom-padding', paddingVal);
        }
    },

    updatePlayState(isPlaying) { TTSUIRenderer.updatePlayState(isPlaying); },
    updateInfo(current, total) { TTSUIRenderer.updateInfo(current, total); },
    updateStatus(text) { TTSUIRenderer.updateStatus(text); },
    updateAutoNextState(isChecked) { TTSUIRenderer.updateAutoNextState(isChecked); },
    updatePlaybackModeState(isParagraph) { TTSUIRenderer.updatePlaybackModeState(isParagraph); },
    updateEngineState(engineId, apiKey) { TTSUIRenderer.updateEngineState(engineId, apiKey); },
    populateVoices(voices, currentVoice) { TTSUIRenderer.populateVoices(voices, currentVoice); },
    updateRateDisplay(val) { TTSUIRenderer.updateRateDisplay(val); },
    updateOfflineStatus(val) { TTSUIRenderer.updateOfflineStatus(val); },
    togglePlayer(show) { TTSUIRenderer.togglePlayer(show); }, 
    closeSettings() { TTSUIRenderer.closeSettings(); } 
};