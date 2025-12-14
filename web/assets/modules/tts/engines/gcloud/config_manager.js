// Path: web/assets/modules/tts/engines/gcloud/config_manager.js
import { AppConfig } from '../../../core/app_config.js';

const KEYS = {
    API_KEY: "tts_gcloud_key",
    VOICE: "tts_gcloud_voice",
    RATE: "tts_gcloud_rate"
};

export class GCloudConfigManager {
    constructor() {
        this.apiKey = localStorage.getItem(KEYS.API_KEY) || "";
        this.rate = parseFloat(localStorage.getItem(KEYS.RATE)) || 1.0;
        
        // Voice Object Defaults
        this.voice = AppConfig.TTS?.DEFAULT_VOICE || { 
            voiceURI: "en-US-Neural2-D", 
            name: "Google US Neural2-D", 
            lang: "en-US" 
        };

        this._loadVoice();
    }

    _loadVoice() {
        const savedURI = localStorage.getItem(KEYS.VOICE);
        if (savedURI) {
            // Restore URI immediately, details might be updated later by VoiceManager
            this.voice = { ...this.voice, voiceURI: savedURI };
        }
    }

    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem(KEYS.API_KEY, key);
    }

    setVoice(voiceObj) {
        if (!voiceObj) return;
        this.voice = voiceObj;
        localStorage.setItem(KEYS.VOICE, voiceObj.voiceURI);
    }

    setRate(rate) {
        this.rate = parseFloat(rate);
        localStorage.setItem(KEYS.RATE, this.rate);
    }

    getApiKey() { return this.apiKey; }
    getRate() { return this.rate; }
    getVoice() { return this.voice; }
}