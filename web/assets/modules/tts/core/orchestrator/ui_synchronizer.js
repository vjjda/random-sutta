// Path: web/assets/modules/tts/core/orchestrator/ui_synchronizer.js
import { TTSStateStore } from 'tts/core/tts_state_store.js';
import { getLogger } from 'utils/logger.js'; // [FUTURE PROOF]

const logger = getLogger("TTS_UISync");

const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
};

export class TTSUISynchronizer {
    constructor(registry) {
        this.ui = null;
        this.registry = registry;
        this.debouncedRefreshOfflineStatus = debounce(() => this.refreshOfflineVoicesStatus(), 1500);
    }

    setUI(uiInstance) {
        this.ui = uiInstance;
        this._syncInitialState();
    }

    _syncInitialState() {
        if (!this.ui) return;
        
        const engine = this.registry.getActiveEngine();
        const gcloud = this.registry.getEngine('gcloud');

        this.ui.updateAutoNextState(TTSStateStore.autoNextEnabled);
        this.ui.updatePlaybackModeState(TTSStateStore.playbackMode === 'paragraph');
        
        const apiKey = gcloud ? gcloud.apiKey : "";
        this.ui.updateEngineState(TTSStateStore.activeEngine, apiKey);
        
        this.ui.populateVoices(engine.getVoices(), engine.voice);
        this.ui.updateRateDisplay(engine.rate);
    }

    onEngineChanged(newEngine) {
        if (!this.ui) return;
        
        this.ui.populateVoices(newEngine.getVoices(), newEngine.voice);
        this.ui.updateRateDisplay(newEngine.rate);
        
        this.debouncedRefreshOfflineStatus();
    }

    async refreshOfflineVoicesStatus() {
        if (!TTSStateStore.isSessionActive) return;

        const engine = this.registry.getActiveEngine();
        if (!engine || typeof engine.getOfflineVoices !== 'function') return;

        const texts = TTSStateStore.playlist.map(item => item.text);
        try {
            const offlineVoiceURIs = await engine.getOfflineVoices(texts);
            if (this.ui) {
                this.ui.updateVoiceOfflineMarkers(offlineVoiceURIs);
            }
        } catch (e) {
            logger.warn("OfflineStatus", "Check failed", e);
        }
    }

    updateStatus(text) { if (this.ui) this.ui.updateStatus(text); }
}