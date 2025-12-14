// Path: web/assets/modules/tts/core/orchestrator/engine_registry.js
import { TTSWebSpeechEngine } from '../../engines/tts_web_speech_engine.js';
import { TTSGoogleCloudEngine } from '../../engines/tts_gcloud_engine.js';
import { TTSStateStore } from '../tts_state_store.js';
import { getLogger } from '../../../utils/logger.js';

const logger = getLogger("TTS_EngineRegistry");

export class TTSEngineRegistry {
    constructor() {
        this.engines = {};
        this.activeEngine = null;
        
        // Callbacks to be hooked by Orchestrator
        this.onEngineChanged = null; 
        this.onAudioCached = null; // Event bubble up
    }

    init() {
        // 1. Instantiate Engines
        this.engines = {
            'wsa': new TTSWebSpeechEngine(),
            'gcloud': new TTSGoogleCloudEngine()
        };

        // 2. Bind Internal Events (e.g. Cache events from GCloud)
        if (this.engines['gcloud']) {
            this.engines['gcloud'].onAudioCached = (text) => {
                if (this.onAudioCached) this.onAudioCached(text);
            };
        }

        // 3. Load Saved Engine
        const savedId = TTSStateStore.activeEngine;
        this.activeEngine = this.engines[savedId] || this.engines['wsa'];
        
        logger.info("Init", `Active Engine: ${savedId || 'wsa'}`);
    }

    /**
     * Switch to a specific engine ID.
     * @returns {boolean} True if changed, False if invalid or same.
     */
    switchEngine(engineId) {
        if (!this.engines[engineId]) {
            logger.warn("Switch", `Unknown engine: ${engineId}`);
            return false;
        }

        if (TTSStateStore.activeEngine === engineId) return false;

        logger.info("Switch", `Switching to ${engineId}...`);
        
        // Update State
        this.activeEngine = this.engines[engineId];
        TTSStateStore.setActiveEngine(engineId);

        // Notify listeners (Orchestrator -> Player/UI)
        if (this.onEngineChanged) {
            this.onEngineChanged(this.activeEngine);
        }

        return true;
    }

    getActiveEngine() {
        return this.activeEngine;
    }

    getEngine(id) {
        return this.engines[id];
    }

    // Proxy methods for Engine specific configs
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