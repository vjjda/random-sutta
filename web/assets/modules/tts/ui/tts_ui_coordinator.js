// Path: web/assets/modules/tts/ui/tts_ui_coordinator.js
import { TTSUILayout } from './tts_ui_layout.js';
import { TTSUIRenderer } from './tts_ui_renderer.js';
import { TTSUIActions } from './tts_ui_actions.js';

export const TTSUICoordinator = {
    orchestrator: null,

    init(orchestratorInstance) {
        this.orchestrator = orchestratorInstance;
        
        TTSUILayout.inject();
        TTSUIRenderer.cacheElements();
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

    // Delegate methods
    updatePlayState(isPlaying) { TTSUIRenderer.updatePlayState(isPlaying); },
    updateInfo(current, total) { TTSUIRenderer.updateInfo(current, total); },
    updateStatus(text) { TTSUIRenderer.updateStatus(text); },
    updateAutoNextState(isChecked) { TTSUIRenderer.updateAutoNextState(isChecked); }
};