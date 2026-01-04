// Path: web/assets/modules/tts/core/orchestrator/engine_registry.js
import { TTSWebSpeechEngine } from 'tts/engines/tts_web_speech_engine.js';
import { TTSGoogleCloudEngine } from 'tts/engines/tts_gcloud_engine.js';
import { TTSStateStore } from 'tts/core/tts_state_store.js';
import { getLogger } from 'utils/logger.js'; // [FUTURE PROOF]

const logger = getLogger("TTS_EngineRegistry");

export class TTSEngineRegistry {
    constructor() {
        this.engines = {};
        this.activeEngine = null;
        this.onEngineChanged = null; 
        this.onAudioCached = null;
    }

    init() {
        this.engines = {
            'wsa': new TTSWebSpeechEngine(),
            'gcloud': new TTSGoogleCloudEngine()
        };

        if (this.engines['gcloud']) {
            this.engines['gcloud'].onAudioCached = (text) => {
                if (this.onAudioCached) this.onAudioCached(text);
            };
        }

        const savedId = TTSStateStore.activeEngine;
        this.activeEngine = this.engines[savedId] || this.engines['wsa'];
        
        logger.info("Init", `Active Engine: ${savedId || 'wsa'}`);
    }

    switchEngine(engineId) {
        if (!this.engines[engineId]) {
            logger.warn("Switch", `Unknown engine: ${engineId}`);
            return false;
        }

        if (TTSStateStore.activeEngine === engineId) return false;

        logger.info("Switch", `Switching to ${engineId}...`);
        
        this.activeEngine = this.engines[engineId];
        TTSStateStore.setActiveEngine(engineId);

        if (this.onEngineChanged) {
            this.onEngineChanged(this.activeEngine);
        }

        return true;
    }

    getActiveEngine() { return this.activeEngine; }
    getEngine(id) { return this.engines[id]; }

    setGCloudApiKey(key) {
        if (this.engines['gcloud']) this.engines['gcloud'].setApiKey(key);
    }

    refreshVoices() {
        if (this.activeEngine.refreshVoices) this.activeEngine.refreshVoices(true);
    }

    setVoice(voiceURI) {
        if (this.activeEngine.setVoice) this.activeEngine.setVoice(voiceURI);
    }
}