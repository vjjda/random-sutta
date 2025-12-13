// Path: web/assets/modules/tts/ui/index.js
import { TTSLayout } from './layout.js';
import { TTSView } from './view.js';
import { TTSEvents } from './events.js';

export const TTSUI = {
    manager: null,

    init(managerInstance) {
        this.manager = managerInstance;
        
        // 1. Inject HTML
        TTSLayout.inject();
        
        // 2. Cache Elements
        TTSView.cacheElements();
        
        // 3. Bind Events
        TTSEvents.bind(this.manager, TTSView);
        
        // 4. Listen to Engine updates (for Voice List)
        this.manager.engine.onVoicesChanged = (voices) => {
            TTSView.populateVoices(voices, this.manager.engine.voice);
        };

        // 5. Sync Initial Settings
        setTimeout(() => {
             TTSView.populateVoices(this.manager.engine.getVoices(), this.manager.engine.voice);
             TTSView.updateRateDisplay(this.manager.engine.rate);
        }, 500);
    },

    // Delegate methods from Manager to View
    updatePlayState(isPlaying) {
        TTSView.updatePlayState(isPlaying);
    },

    updateInfo(current, total) {
        TTSView.updateInfo(current, total);
    }
};